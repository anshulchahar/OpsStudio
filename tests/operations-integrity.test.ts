import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPost } from "./helpers/provider-fixture.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const quiet = { log() {}, info() {}, warn() {}, error() {} };
function runScript(relative: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/^import[^\n]*\n/gm, "");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(...Object.keys(dependencies), source)(...Object.values(dependencies)) as Promise<void>;
}
function migrationFixture(history: string[], localVersions = ["20260912000000", "20260913000000", "20260914000000"]) {
  const files = localVersions.map((version) => `${version}_fixture.sql`);
  const sql = new Map([...localVersions, ...history].map((version) => [version, `select '${version}' /* local fixture */;\n`]));
  const applied: string[] = [];
  let ended = false;
  const client = {
    connect: async () => {}, end: async () => { ended = true; },
    query: async (query: string) => {
      if (query.includes("to_regclass('supabase_migrations.schema_migrations')")) return { rows: [{ present: "supabase_migrations.schema_migrations" }] };
      if (query === "select version,statements from supabase_migrations.schema_migrations") return { rows: history.map((version) => ({ version, statements: [sql.get(version)] })) };
      if ([...sql.values()].includes(query)) applied.push(query);
      return { rows: [] };
    },
  };
  const run = () => runScript("scripts/migrate.mjs", {
    pg: { Client: class { constructor() { return client; } } },
    readFile: async (path: string) => sql.get(path.split("/").at(-1)!.slice(0, 14)),
    readdir: async () => files,
    assert,
    process: { env: { MIGRATION_DATABASE_URL: "postgresql://fixture:fixture@localhost/test" }, argv: [] },
    console: quiet,
  });
  return { run, applied, ended: () => ended };
}

describe("operations integrity regressions", () => {
  it("malformed database URLs fail without echoing credentials from backup or migration scripts", () => {
    const marker = "FAKE_PASSWORD_REDACTION_FIXTURE";
    const bad = `postgresql://fixture:${marker}@fixture.invalid:invalid-port/postgres`;
    for (const script of ["scripts/backup.mjs", "scripts/migrate.mjs"]) {
      const result = spawnSync(process.execPath, [script], {
        cwd: repository, encoding: "utf8", timeout: 5000,
        env: {
          NODE_ENV: "test",
          MIGRATION_DATABASE_URL: bad, POSTGRES_URL_NON_POOLING: bad,
          PGSSLROOTCERT: "/nonexistent/fixture.crt", BACKUP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
        },
      });
      assert.equal(result.status, 1, script);
      assert.doesNotMatch(result.stderr + result.stdout, new RegExp(marker), script);
      assert.doesNotMatch(result.stderr + result.stdout, /input: 'postgresql:/, script);
    }
  });

  it("monitoring fails when its dependency-monitor secret is missing", async () => {
    let calls = 0;
    const fakeProcess: { env: Record<string, string>; exitCode?: number } = { env: { MONITOR_URL: "https://fixture.invalid" } };
    let rejected = false;
    try {
      await runScript("scripts/monitor.mjs", {
        process: fakeProcess, console: quiet,
        fetch: async () => { calls++; return { ok: true, text: async () => "OpsStudio", json: async () => ({ status: "ok" }) }; },
      });
    } catch { rejected = true; }
    assert.ok(rejected || fakeProcess.exitCode === 1, "Missing credentials must fail the monitoring job");
    assert.equal(calls, 0, "Missing configuration should fail before probes run");
  });

  it("configured monitoring checks readiness and only sends its bearer token to that endpoint", async () => {
    const observed: { path: string; auth: string | undefined }[] = [];
    const fakeProcess: { env: Record<string, string>; exitCode?: number } = { env: { MONITOR_URL: "https://fixture.invalid", MONITOR_SECRET: "fixture-monitor-token" } };
    await runScript("scripts/monitor.mjs", {
      process: fakeProcess, console: quiet,
      fetch: async (url: URL, options: { headers: { authorization?: string } }) => {
        observed.push({ path: url.pathname, auth: options.headers.authorization });
        return { ok: true, text: async () => "OpsStudio", json: async () => ({ status: url.pathname === "/api/readiness" ? "ready" : "ok" }) };
      },
    });
    assert.deepEqual(observed, [
      { path: "/api/health", auth: undefined }, { path: "/", auth: undefined },
      { path: "/api/readiness", auth: "Bearer fixture-monitor-token" },
    ]);
    assert.equal(fakeProcess.exitCode || 0, 0);
  });

  it("rejects migration history absent from this checkout before applying SQL", async () => {
    const f = migrationFixture(["20260912000000", "20260915000000"]);
    await assert.rejects(f.run);
    assert.deepEqual(f.applied, []);
    assert.equal(f.ended(), true);
  });

  it("rejects an unapplied older migration even when every recorded version is present locally", async () => {
    const f = migrationFixture(["20260912000000", "20260914000000"]);
    await assert.rejects(f.run);
    assert.deepEqual(f.applied, []);
    assert.equal(f.ended(), true);
  });

  it("allows append-only migrations and validates repeat runs without reapplying SQL", async () => {
    const forward = migrationFixture(["20260912000000"]);
    await forward.run();
    assert.equal(forward.applied.length, 2);
    const repeated = migrationFixture(["20260912000000", "20260913000000", "20260914000000"]);
    await repeated.run();
    assert.deepEqual(repeated.applied, []);
  });

  it("operation persistence reports failure for database errors and exceptions", async () => {
    const source = stripTypeScriptTypes(readFileSync(new URL("../src/lib/operations.ts", import.meta.url), "utf8"), { mode: "transform" })
      .replace(/^import[\s\S]*?;\s*/gm, "").replace(/^export /gm, "");
    for (const failure of ["database", "exception", "none"]) {
      const adminSupabase = () => ({ from: () => ({ upsert: () => ({ abortSignal: async () => {
        if (failure === "exception") throw new Error("fixture failure");
        return { error: failure === "database" ? { code: "fixture" } : null };
      } }) }) });
      const record = new Function("adminSupabase", "console", `${source}; return recordOperation;`)(adminSupabase, quiet) as (id: string, status: string, code: string) => Promise<boolean>;
      assert.equal(await record("backup", "ok", "FIXTURE"), failure === "none");
    }
  });

  it("backup reporting acknowledges persistence only after it succeeds", async () => {
    for (const stored of [true, false]) {
      const handler = loadPost("src/app/api/operations/backup/route.ts", {
        authorizedJob: () => true, recordOperation: async () => stored,
      });
      const response = await handler(new Request("https://fixture.invalid/api/operations/backup", { method: "POST" }));
      assert.equal(response.status, stored ? 200 : 503);
      if (stored) assert.equal((await response.json()).recorded, true);
      else assert.notEqual((await response.json()).recorded, true);
    }
  });
});

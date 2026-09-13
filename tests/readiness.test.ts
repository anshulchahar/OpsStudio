import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { releaseFreshness } from "../src/lib/release-freshness.ts";

function fixture(status = "ok", jobTime = new Date().toISOString()) {
  const now = new Date().toISOString();
  const queried: string[] = [];
  const rows = ["maintenance", "backup", "release:node"].map(id => ({ id, status: id === "release:node" ? status : "ok", checked_at: id === "backup" ? jobTime : now }));
  const db = { from: (table: string) => ({ select: () => {
    const query = {
      in: (_: string, ids: string[]) => { queried.push(...ids); return query; },
      abortSignal: async () => ({ error: null, data: table === "release_catalog" ? [{ id: "node", checked_at: now }] : rows }),
    };
    return query;
  } }) };
  const source = stripTypeScriptTypes(readFileSync(new URL("../src/app/api/readiness/route.ts", import.meta.url), "utf8"), { mode: "transform" })
    .replace(/^import[\s\S]*?;\s*/gm, "").replace(/^export /gm, "");
  const handler = new Function("adminSupabase", "authorizedJob", "releaseSources", "releaseFreshness", "fetch", `${source}; return GET;`)(
    () => db, () => true, [{ id: "node" }], releaseFreshness, async () => ({ ok: true }),
  ) as (request: Request) => Promise<Response>;
  return { run: () => handler(new Request("https://fixture.invalid/api/readiness")), queried };
}

test("readiness monitors the most recent attempt for every release source", async () => {
  const f = fixture();
  const response = await f.run();
  assert.equal(response.status, 200);
  assert.deepEqual(f.queried, ["maintenance", "backup", "release:node"]);
});

test("a failed refresh degrades monitoring even while the previous release is fresh", async () => {
  const response = await fixture("error").run();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).checks.catalog, false);
});

test("a future-dated backup cannot indefinitely satisfy the recovery check", async () => {
  const response = await fixture("ok", new Date(Date.now() + 120_000).toISOString()).run();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).checks.backup, false);
});

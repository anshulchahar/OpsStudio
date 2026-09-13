import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { errorResponse, integerEnv, readBody } from "../src/lib/http.ts";
import { labRecipe, recipeIds } from "../src/lib/lab-recipes.ts";
import { databaseFixture, loadPost, userId } from "./helpers/provider-fixture.ts";
const request = () => new Request("https://example.invalid/api/lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipe: recipeIds[0] }) });
function fixture(failExecution = false) {
  const f = databaseFixture();
  let starts = 0; let stops = 0;
  const handler = loadPost("src/app/api/lab/route.ts", {
    currentUser: async () => ({ id: userId }), adminSupabase: () => f.db,
    randomUUID, z, readBody, errorResponse, integerEnv, labRecipe, recipeIds,
    process: { env: {} },
    Sandbox: { create: async (options: unknown) => {
      starts++;
      assert.deepEqual(options, { runtime: "node24", timeout: 45000, resources: { vcpus: 1 }, networkPolicy: "deny-all" });
      return {
        writeFiles: async () => {},
        runCommand: async () => ({ exitCode: failExecution ? 1 : 0, stdout: async () => JSON.stringify({ passed: true, evidence: "local fixture" }) }),
        stop: async () => { stops++; },
      };
    } },
  });
  return { ...f, handler, starts: () => starts, stops: () => stops };
}
describe("lab reservation integrity", () => {
  it("does not start a sandbox when atomic quota and result reservation fail", async () => {
    const f = fixture(); f.failures.add("claim_lab_run");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.starts(), 0); assert.equal(f.reservations(), 0);
  });
  it("saves successful evidence against the reserved run and stops the bounded sandbox", async () => {
    const f = fixture();
    const result = await f.handler(request());
    assert.equal(result.status, 200);
    assert.equal(f.tables.lab_runs[0].status, "complete");
    assert.ok(f.tables.lab_runs[0].finished_at);
    assert.equal(f.starts(), 1); assert.equal(f.stops(), 1);
  });
  it("persists a failed execution and does not automatically retry", async () => {
    const f = fixture(true);
    assert.equal((await f.handler(request())).status, 502);
    assert.equal(f.tables.lab_runs[0].status, "error");
    assert.equal(f.tables.lab_runs[0].error_category, "execution_failed");
    assert.equal(f.starts(), 1); assert.equal(f.stops(), 1);
  });
});

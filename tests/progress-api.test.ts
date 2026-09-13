import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { describe, it } from "node:test";
import { emptyProgress } from "../src/lib/engine.ts";
import { readBody, errorResponse } from "../src/lib/http.ts";
import { PROGRESS_MAX_BYTES, progressWriteSchema } from "../src/lib/progress-sync.ts";
const userId = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const calls: unknown[] = [];
  const state = { user: { id: userId } as { id: string } | null, payload: null as unknown, revision: 0, fail: false };
  const query = { select() { return this; }, eq(_field: string, id: string) { assert.equal(id, state.user?.id); return this; }, async maybeSingle() { return { data: state.payload ? { payload: state.payload, revision: state.revision } : null, error: state.fail ? new Error("read failed") : null }; } };
  const db = {
    auth: { getUser: async () => ({ data: { user: state.user } }) }, from: () => query,
    rpc: async (name: string, body: { p_payload: unknown; p_expected_revision: number }) => {
      calls.push({ name, body });
      if (state.fail) return { data: null, error: new Error("unavailable") };
      if (body.p_expected_revision !== state.revision) return { data: { saved: false, revision: state.revision, payload: state.payload }, error: null };
      state.revision++; state.payload = body.p_payload;
      return { data: { saved: true, revision: state.revision, payload: state.payload }, error: null };
    },
  };
  const source = stripTypeScriptTypes(readFileSync(new URL("../src/app/api/progress/route.ts", import.meta.url), "utf8"), { mode: "transform" }).replace(/^import[\s\S]*?;\s*/gm, "").replace(/^export /gm, "");
  const dependencies = { serverSupabase: async () => db, readBody, errorResponse, progressWriteSchema, PROGRESS_MAX_BYTES };
  const routes = new Function(...Object.keys(dependencies), `${source};return {GET,PUT};`)(...Object.values(dependencies)) as { GET(request: Request): Promise<Response>; PUT(request: Request): Promise<Response> };
  return { ...routes, state, calls };
}
const put = (body: unknown) => new Request("https://example.invalid/api/progress", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const body = (expectedRevision = 0, progress = structuredClone(emptyProgress)) => ({ expectedUserId: userId, expectedRevision, progress });
describe("progress API account and revision contract", () => {
  it("requires authentication and the captured account for reads", async () => {
    const f = fixture();
    assert.equal((await f.GET(new Request("https://example.invalid/api/progress"))).status, 403);
    const response = await f.GET(new Request("https://example.invalid/api/progress", { headers: { "x-opsstudio-principal": userId } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { userId, progress: null, revision: 0 });
    assert.equal(response.headers.get("cache-control"), "no-store");
    f.state.user = null;
    assert.equal((await f.GET(new Request("https://example.invalid/api/progress"))).status, 401);
  });
  it("rejects a stale principal before calling the database mutation", async () => {
    const f = fixture();
    const response = await f.PUT(put({ ...body(), expectedUserId: "22222222-2222-4222-8222-222222222222" }));
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 0);
  });
  it("rejects old unversioned clients instead of allowing a blind overwrite", async () => {
    const f = fixture();
    assert.equal((await f.PUT(put(emptyProgress))).status, 400);
    assert.equal(f.calls.length, 0);
  });
  it("returns the authoritative snapshot and a conflict status for a stale save", async () => {
    const f = fixture();
    const first = { ...structuredClone(emptyProgress), notes: "first device" };
    assert.equal((await f.PUT(put(body(0, first)))).status, 200);
    const response = await f.PUT(put(body(0, { ...first, notes: "stale device" })));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { saved: false, progress: first, revision: 1, userId });
    assert.equal((f.state.payload as typeof first).notes, "first device");
  });
  it("acknowledges only accepted writes and never reports provider errors as saved", async () => {
    const f = fixture();
    const response = await f.PUT(put(body()));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revision, 1);
    f.state.fail = true;
    assert.equal((await f.PUT(put(body(1)))).status, 503);
  });
  it("bounds actual streamed request bytes before making a database call", async () => {
    const f = fixture();
    const oversized = new Request("https://example.invalid/api/progress", { method: "PUT", headers: { "content-type": "application/json" }, body: " ".repeat(PROGRESS_MAX_BYTES + 4097) });
    assert.equal((await f.PUT(oversized)).status, 400);
    assert.equal(f.calls.length, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { errorResponse, integerEnv, readBody } from "../src/lib/http.ts";
import { initialSystem } from "../src/lib/engine.ts";
import { missions } from "../src/lib/curriculum.ts";
import { mentorRequestSchema, resolveMentorContext } from "../src/lib/mentor-context.ts";
import { geminiUsage, parseGeminiAnswer } from "../src/lib/gemini-result.ts";
import { databaseFixture, loadPost, userId } from "./helpers/provider-fixture.ts";

const body = { question: "Explain the next step.", missionId: missions[0].id, state: initialSystem };
const request = () => new Request("https://example.invalid/api/mentor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const validData = () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ answer: "A useful answer.", hint: "Inspect the evidence.", action: null }) }] } }], usageMetadata: { promptTokenCount: 355, candidatesTokenCount: 178, thoughtsTokenCount: 12 } });
function mentorFixture() {
  const f = databaseFixture();
  let providerCalls = 0;
  let provider: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> = async () => ({ ok: true, status: 200, json: async () => validData() });
  const handler = loadPost("src/app/api/mentor/route.ts", {
    currentUser: async () => ({ id: userId }), adminSupabase: () => f.db,
    createHash, randomUUID, readBody, errorResponse, integerEnv,
    mentorRequestSchema, resolveMentorContext, geminiUsage, parseGeminiAnswer,
    fetch: async () => { providerCalls++; return provider(); },
    process: { env: { GEMINI_API_KEY: "fixture", GEMINI_MODEL: "gemini-3.1-flash-lite" } },
    console: { error() {} },
  });
  return { ...f, handler, calls: () => providerCalls, provider: (value: typeof provider) => { provider = value; } };
}

describe("mentor generation integrity", () => {
  it("claims identical concurrent questions once and returns the original pending ID", async () => {
    const f = mentorFixture();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    let called!: () => void;
    const entered = new Promise<void>((resolve) => { called = resolve; });
    f.provider(async () => { called(); await barrier; return { ok: true, status: 200, json: async () => validData() }; });
    const first = f.handler(request()); await entered;
    const duplicate = await f.handler(request());
    assert.equal(duplicate.status, 409);
    const pending = await duplicate.json();
    assert.equal(pending.pending, true);
    assert.equal(pending.id, f.tables.ai_generations[0].id);
    assert.equal(f.calls(), 1); assert.equal(f.reservations(), 1);
    release(); assert.equal((await first).status, 200);
    const cached = await f.handler(request());
    assert.equal(cached.status, 200); assert.equal((await cached.json()).cached, true);
    assert.equal(f.calls(), 1); assert.equal(f.reservations(), 1);
  });

  it("records billed usage and cost when a provider returns malformed answer JSON", async () => {
    const f = mentorFixture();
    f.provider(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "truncated invalid JSON" }] } }], usageMetadata: { promptTokenCount: 355, candidatesTokenCount: 178 } }) }));
    assert.equal((await f.handler(request())).status, 502);
    assert.equal(f.tables.ai_generations[0].status, "error");
    assert.equal(f.tables.ai_generations[0].input_tokens, 355);
    assert.equal(f.tables.ai_generations[0].output_tokens, 178);
    assert.equal(f.tables.ai_generations[0].usage_known, true);
    assert.equal(f.tables.ai_generations[0].estimated_usd, 0.00035575);
    assert.equal(f.tables.ai_generations[0].finish_reason, "MAX_TOKENS");
  });

  it("preserves usage for valid JSON which fails the answer schema", async () => {
    const f = mentorFixture();
    f.provider(async () => ({ ok: true, status: 200, json: async () => ({ ...validData(), candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: [], hint: "bad", action: null }) }] } }] }) }));
    assert.equal((await f.handler(request())).status, 502);
    assert.equal(f.tables.ai_generations[0].output_tokens, 190);
    assert.equal(f.tables.ai_generations[0].usage_known, true);
  });

  it("leaves unknown cost explicit after an HTTP or transport failure", async () => {
    const f = mentorFixture();
    f.provider(async () => { throw new Error("fixture transport failed"); });
    assert.equal((await f.handler(request())).status, 502);
    assert.equal(f.tables.ai_generations[0].estimated_usd, null);
    assert.equal(f.tables.ai_generations[0].usage_known, false);
    assert.equal(f.calls(), 1);
  });

  it("a failed atomic reservation never calls Gemini or consumes a local quota record", async () => {
    const f = mentorFixture(); f.failures.add("claim_mentor_generation");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.calls(), 0); assert.equal(f.reservations(), 0);
    assert.equal(f.tables.ai_generations.length, 0);
  });

  it("a stale pending claim is marked failed before one explicit new request is reserved", async () => {
    const f = mentorFixture();
    const context = resolveMentorContext(body);
    const cacheKey = createHash("sha256").update(JSON.stringify({ v: 2, model: "gemini-3.1-flash-lite", context })).digest("hex");
    f.tables.ai_generations.push({ id: "old-generation", user_id: userId, cache_key: cacheKey, status: "pending", created_at: new Date(Date.now() - 300000).toISOString(), lease_expires_at: new Date(Date.now() - 180000).toISOString(), usage_known: false, estimated_usd: null });
    assert.equal((await f.handler(request())).status, 200);
    assert.equal(f.tables.ai_generations[0].status, "error");
    assert.equal(f.tables.ai_generations[0].error_category, "lease_expired");
    assert.equal(f.tables.ai_generations[0].estimated_usd, null);
    assert.equal(f.tables.ai_generations[1].status, "complete");
    assert.equal(f.calls(), 1); assert.equal(f.reservations(), 1);
  });

  it("records token counts without inventing a zero price for an unknown model", () => {
    const usage = geminiUsage(validData(), "unpriced-model");
    assert.equal(usage.usage_known, true);
    assert.equal(usage.output_tokens, 190);
    assert.equal(usage.estimated_usd, null);
    assert.equal(geminiUsage({}, "gemini-3.1-flash-lite").estimated_usd, null);
    assert.equal(geminiUsage({ usageMetadata: { promptTokenCount: -1, candidatesTokenCount: "100" } }, "gemini-3.1-flash-lite").usage_known, false);
  });
});

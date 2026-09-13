import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const userA = "44444444-4444-4444-8444-444444444444";
const userB = "55555555-5555-4555-8555-555555555555";
const origin = "https://opsstudio.example.invalid";
function token(id: string) {
  return `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.c3ludGhldGlj`;
}

// Execute the actual route, replacing only build-time import aliases. Every
// network request is captured locally; these fixtures never reach a provider.
test("password route binds verification and update to one bearer, with HTTP guards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opsstudio-password-route-"));
  const source = await readFile(new URL("../src/app/api/account/password/route.ts", import.meta.url), "utf8");
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace('"@supabase/supabase-js"', JSON.stringify(pathToFileURL(require.resolve("@supabase/supabase-js")).href))
    .replace('"@/lib/http"', JSON.stringify(new URL("../src/lib/http.ts", import.meta.url).href))
    .replace('"@/lib/password-actions"', JSON.stringify(new URL("../src/lib/password-actions.ts", import.meta.url).href));
  await writeFile(join(directory, "route.mjs"), compiled);
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public-key";
  const requests: { method: string; userId: string }[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://auth-test.example.invalid/auth/v1/user");
    const bearer = new Headers(init?.headers).get("authorization")!;
    const claims = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString());
    requests.push({ method: init?.method ?? "GET", userId: claims.sub });
    return new Response(JSON.stringify({ id: claims.sub, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-09-13T00:00:00Z" }), { headers: { "content-type": "application/json" } });
  };
  try {
    const { POST } = await import(pathToFileURL(join(directory, "route.mjs")).href);
    function request(expectedUserId = userA, actualUserId = userA, requestOrigin: string | null = origin, rawBody?: string) {
      return new Request(`${origin}/api/account/password`, { method: "POST", headers: { ...(requestOrigin ? { origin: requestOrigin } : {}), "content-type": "application/json", authorization: `Bearer ${token(actualUserId)}`, cookie: `different-current-browser-account=${userB}` }, body: rawBody ?? JSON.stringify({ expectedUserId, password: "synthetic-test-password" }) });
    }
    const success = await POST(request());
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { updated: true, userId: userA });
    assert.equal(success.headers.get("set-cookie"), null, "A previous account must never overwrite the browser's next session");
    assert.equal(success.headers.get("cache-control"), "no-store");
    assert.deepEqual(requests, [{ method: "GET", userId: userA }, { method: "PUT", userId: userA }]);
    requests.length = 0;
    assert.equal((await POST(request(userA, userB))).status, 409);
    assert.deepEqual(requests, [{ method: "GET", userId: userB }]);
    requests.length = 0;
    assert.equal((await POST(request(userA, userA, "https://untrusted.example.invalid"))).status, 403);
    assert.equal((await POST(request(userA, userA, null))).status, 403);
    assert.equal((await POST(request(userA, userA, origin, JSON.stringify({ expectedUserId: userA, password: "p".repeat(9000) })))).status, 400);
    assert.deepEqual(requests, [], "Rejected origins and oversized requests must not call Auth");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    await rm(directory, { recursive: true, force: true });
  }
});

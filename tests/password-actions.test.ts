import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { changeRequestPassword } from "../src/lib/password-actions.ts";

const userA = "44444444-4444-4444-8444-444444444444";
const userB = "55555555-5555-4555-8555-555555555555";
const password = "synthetic-test-password";

function fakeUser(id: string) {
  return { id, aud: "authenticated", role: "authenticated", email: `${id}@example.invalid`, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-13T00:00:00Z" };
}
function fakeSession(id: string) {
  const payload = Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return { access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${payload}.c3ludGhldGlj`, refresh_token: "synthetic-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fakeUser(id) };
}
function sdkFixture() {
  const storageKey = `test-auth-${crypto.randomUUID()}`;
  const storage = new Map<string, string>([[storageKey, JSON.stringify(fakeSession(userA))]]);
  const updates: string[] = [];
  const client = createClient("https://auth-test.example.invalid", "synthetic-public-key", {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, storageKey, storage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
      removeItem: key => { storage.delete(key); },
    } },
    global: { fetch: async (input, init) => {
      assert.ok(String(input).endsWith("/auth/v1/user"), "Every request must stay in this mock; no provider calls are permitted");
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      const claims = JSON.parse(Buffer.from(authorization.split(".")[1], "base64url").toString());
      if (init?.method === "PUT") updates.push(claims.sub);
      return new Response(JSON.stringify(fakeUser(claims.sub)), { status: 200, headers: { "content-type": "application/json" } });
    } },
  });
  return { client, updates, switchStorage: (id: string) => storage.set(storageKey, JSON.stringify(fakeSession(id))) };
}

test("SDK regression reproduces shared-storage principal switch after a prior identity check", async () => {
  const { client, switchStorage, updates } = sdkFixture();
  assert.equal((await client.auth.getUser()).data.user?.id, userA);
  const pending = client.auth.updateUser({ password });
  // updateUser yields before reading shared session storage, as another tab can do.
  switchStorage(userB);
  await pending;
  assert.deepEqual(updates, [userB]);
});

test("a changed request principal is rejected before any password update", async () => {
  const { client, switchStorage, updates } = sdkFixture();
  switchStorage(userB);
  const result = await changeRequestPassword({ expectedUserId: userA, password }, { getUser: () => client.auth.getUser(), updateUser: attributes => client.auth.updateUser(attributes) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  assert.deepEqual(updates, []);
});

test("a request-scoped SDK snapshot keeps the intended principal through a browser switch", async () => {
  const request = sdkFixture();
  const browser = sdkFixture();
  const pending = changeRequestPassword({ expectedUserId: userA, password }, { getUser: () => request.client.auth.getUser(), updateUser: attributes => request.client.auth.updateUser(attributes) });
  browser.switchStorage(userB);
  assert.deepEqual(await pending, { ok: true, userId: userA });
  assert.deepEqual(request.updates, [userA]);
  assert.deepEqual(browser.updates, []);
});

test("missing authentication and invalid password never invoke update", async () => {
  let updates = 0;
  const session = { getUser: async () => ({ data: { user: null }, error: null }), updateUser: async () => { updates++; return { data: { user: fakeUser(userA) }, error: null }; } };
  const invalid = await changeRequestPassword({ expectedUserId: userA, password: "short" }, session);
  const expired = await changeRequestPassword({ expectedUserId: userA, password }, session);
  assert.equal(invalid.ok, false); if (!invalid.ok) assert.equal(invalid.status, 400);
  assert.equal(expired.ok, false); if (!expired.ok) assert.equal(expired.status, 401);
  assert.equal(updates, 0);
});

test("a provider rejection never produces a successful password update", async () => {
  const result = await changeRequestPassword({ expectedUserId: userA, password }, { getUser: async () => ({ data: { user: fakeUser(userA) }, error: null }), updateUser: async () => ({ data: { user: null }, error: new Error("provider rejected the password") }) });
  assert.equal(result.ok, false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { accountDeletionSchema, AccountActionError, collectExportPages, encodeAccountExport, eraseAccount, publicAccountIdentity } from "../src/lib/account-actions.ts";

const userId = "44444444-4444-4444-8444-444444444444";
const otherUserId = "55555555-5555-4555-8555-555555555555";
const input = { confirmation: "DELETE", password: "test-password-never-logged", expectedUserId: userId, cancelSubscriptions: false };
function fixture() {
  const steps: string[] = [];
  const dependencies = {
    verifyPassword: async (password: string) => { assert.equal(password, input.password); steps.push("verify"); return { userId, accessToken: "temporary-verification-token" }; },
    prepareBilling: async (consent: boolean) => { steps.push(`billing:${consent}`); },
    revokeSessions: async (token: string) => { assert.equal(token, "temporary-verification-token"); steps.push("revoke-all"); },
    deleteUser: async () => { steps.push("delete-user"); },
    closeVerificationSession: async (token: string) => { assert.equal(token, "temporary-verification-token"); steps.push("close-verification"); },
  };
  return { dependencies, steps };
}

test("account erasure rejects a changed principal before password or billing operations", async () => {
  const { dependencies, steps } = fixture();
  await assert.rejects(eraseAccount(otherUserId, input, dependencies), (error: unknown) => error instanceof AccountActionError && error.status === 409 && error.code === "ACCOUNT_CHANGED");
  assert.deepEqual(steps, []);
});

test("account erasure needs the exact confirmation and an explicit current password", async () => {
  const { dependencies, steps } = fixture();
  for (const change of [{ confirmation: "delete" }, { password: "" }, { expectedUserId: "not-a-uuid" }, { cancelSubscriptions: "yes" }]) {
    await assert.rejects(eraseAccount(userId, { ...input, ...change }, dependencies));
  }
  assert.deepEqual(steps, []);
  assert.equal(accountDeletionSchema.parse({ confirmation: "DELETE", password: "p", expectedUserId: userId }).cancelSubscriptions, false);
});

test("a password verification for a different account never reaches billing or deletion", async () => {
  const { dependencies, steps } = fixture();
  dependencies.verifyPassword = async () => { steps.push("verify"); return { userId: otherUserId, accessToken: "temporary-verification-token" }; };
  await assert.rejects(eraseAccount(userId, input, dependencies), /did not verify this account/);
  assert.deepEqual(steps, ["verify", "close-verification"]);
});

test("wrong-password verification cannot cancel billing or revoke the user's sessions", async () => {
  const { dependencies, steps } = fixture();
  dependencies.verifyPassword = async () => { steps.push("verify"); throw new Error("password check denied"); };
  await assert.rejects(eraseAccount(userId, input, dependencies), /password check denied/);
  assert.deepEqual(steps, ["verify"]);
});

test("unresolved billing blocks erasure and closes only its temporary verification session", async () => {
  const { dependencies, steps } = fixture();
  dependencies.prepareBilling = async (consent) => { steps.push(`billing:${consent}`); throw new Error("subscription cancellation needs consent"); };
  await assert.rejects(eraseAccount(userId, input, dependencies), /needs consent/);
  assert.deepEqual(steps, ["verify", "billing:false", "close-verification"]);
});

test("explicit cancellation consent is passed to billing before session revocation and deletion", async () => {
  const { dependencies, steps } = fixture();
  assert.deepEqual(await eraseAccount(userId, { ...input, cancelSubscriptions: true }, dependencies), { deleted: true });
  assert.deepEqual(steps, ["verify", "billing:true", "revoke-all", "delete-user"]);
});

test("failed global session revocation prevents user deletion", async () => {
  const { dependencies, steps } = fixture();
  dependencies.revokeSessions = async () => { steps.push("revoke-all"); throw new Error("auth unavailable"); };
  await assert.rejects(eraseAccount(userId, input, dependencies), /auth unavailable/);
  assert.deepEqual(steps, ["verify", "billing:false", "revoke-all", "close-verification"]);
});

test("a failed user deletion is not reported as completed after billing or session changes", async () => {
  const { dependencies, steps } = fixture();
  dependencies.deleteUser = async () => { steps.push("delete-user"); throw new Error("delete incomplete"); };
  await assert.rejects(eraseAccount(userId, input, dependencies), /delete incomplete/);
  assert.deepEqual(steps, ["verify", "billing:false", "revoke-all", "delete-user"]);
});

test("temporary-session cleanup errors do not hide the actionable billing failure", async () => {
  const { dependencies } = fixture();
  dependencies.prepareBilling = async () => { throw new Error("billing reconciliation required"); };
  dependencies.closeVerificationSession = async () => { throw new Error("cleanup unavailable"); };
  await assert.rejects(eraseAccount(userId, input, dependencies), /billing reconciliation required/);
});

test("account export follows all pages instead of silently stopping at the API row limit", async () => {
  const source = Array.from({ length: 1264 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const result = await collectExportPages(async (from, to) => { ranges.push([from, to]); return { data: source.slice(from, to + 1), error: null }; });
  assert.deepEqual(result, source);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
});

test("account export errors after a partial page never return an incomplete success", async () => {
  let request = 0;
  await assert.rejects(collectExportPages(async () => ++request === 1 ? { data: Array(500).fill({}), error: null } : { data: null, error: new Error("database unavailable") }), (error: unknown) => error instanceof AccountActionError && error.code === "EXPORT_UNAVAILABLE");
});

test("account export has a bounded size and fails explicitly instead of truncating", async () => {
  await assert.rejects(collectExportPages(async () => ({ data: Array(500).fill({}), error: null })), (error: unknown) => error instanceof AccountActionError && error.status === 413);
});

test("exported auth identity never includes provider metadata or authentication secrets", () => {
  const user = { id: userId, email: "learner@example.invalid", created_at: "2026-09-13T00:00:00Z", email_confirmed_at: "2026-09-13T00:00:00Z", app_metadata: { provider: "email", internal: "private" }, identities: [{ secret: "private" }], access_token: "private" };
  assert.deepEqual(publicAccountIdentity(user), { id: userId, email: user.email, createdAt: user.created_at, emailConfirmedAt: user.email_confirmed_at });
  assert.equal(JSON.stringify(publicAccountIdentity(user)).includes("private"), false);
});

test("account export compression preserves every stored field and Unicode note", () => {
  const data = { account: { id: userId }, notes: "Prüfung → Grüße", answers: Array.from({ length: 800 }, (_, id) => ({ id, answer: "A complete saved answer. ".repeat(300) })) };
  const result = encodeAccountExport(data);
  assert.deepEqual(JSON.parse(gunzipSync(result).toString("utf8")), data);
  assert.ok(result.byteLength < 4 * 1024 * 1024);
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  assertPaymentsEnabled, stripeKeyMode, BillingError, assertSafeRetry,
} from "../src/lib/billing-policy.ts";
import {
  acquireBillingLease, billingWrite, createOrReuseCheckout, reconcileBilling, releaseBillingLease, prepareBillingErasure,
} from "../src/lib/billing-runtime.ts";
import { errorResponse } from "../src/lib/http.ts";
import { databaseFixture, stripeFixture, loadPost, userId } from "./helpers/provider-fixture.ts";
const input = { userId, liveMode: false, priceId: "price_fixture", origin: "https://example.invalid" };

function checkoutFixture() {
  const db = databaseFixture();
  const provider = stripeFixture();
  const handler = loadPost("src/app/api/checkout/route.ts", {
    currentUser: async () => ({ id: userId }), adminSupabase: () => db.db,
    stripeClient: () => provider.stripe, appOrigin: () => input.origin,
    readBody: async () => ({}), errorResponse, assertPaymentsEnabled, BillingError,
    createOrReuseCheckout, operatorDetails: () => ({ configured: true }), z,
    process: { env: { STRIPE_PRICE_ID: input.priceId, STRIPE_SECRET_KEY: "sk_test_fixture" } },
  });
  return { ...db, ...provider, handler };
}
const request = () => new Request("https://example.invalid/api/checkout", { method: "POST" });

describe("billing integrity regressions", () => {
  it("fails closed for both live secret and restricted keys, and unknown key formats", () => {
    for (const key of ["sk_live_fixture", "rk_live_fixture"]) {
      assert.throws(() => assertPaymentsEnabled(key, "false"), /not been enabled/);
      assert.throws(() => assertPaymentsEnabled(key, undefined), /not been enabled/);
      assert.equal(assertPaymentsEnabled(key, "true"), "live");
    }
    for (const key of ["sk_test_fixture", "rk_test_fixture"]) assert.equal(assertPaymentsEnabled(key, "false"), "test");
    for (const key of [undefined, "pk_live_fixture", "not-a-key"]) assert.throws(() => stripeKeyMode(key));
  });

  it("reuses one stable customer and hosted checkout across repeated route requests", async (t) => {
    const f = checkoutFixture();
    const first = await f.handler(request());
    assert.equal(first.status, 200);
    const now = Date.now();
    t.mock.method(Date, "now", () => now + 61000);
    const second = await f.handler(request());
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { ...(await first.json()), reused: true });
    assert.equal(f.createCalls.filter((call) => call.kind === "customer").length, 1);
    assert.equal(f.createCalls.filter((call) => call.kind === "checkout").length, 1);
    assert.equal(f.tables.billing_checkout_attempts.length, 1);
    assert.equal(f.createCalls.find((call) => call.kind === "checkout")!.params.customer, "cus_fixture1");
  });

  it("rejects a concurrent checkout while one owns the database claim", async () => {
    const f = checkoutFixture();
    const lease = await acquireBillingLease(f.db, userId, false);
    const second = await f.handler(request());
    assert.equal(second.status, 409);
    assert.equal(f.createCalls.length, 0);
    await releaseBillingLease(f.db, lease);
  });

  it("fails closed before a provider mutation when the claim cannot be read", async () => {
    const f = checkoutFixture(); f.failures.add("claim_billing_operation");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.createCalls.length, 0);
  });

  it("fails closed if earlier checkout lookup fails", async () => {
    const f = checkoutFixture();
    assert.equal((await f.handler(request())).status, 200);
    f.failures.add("read:billing_checkout_attempts");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.sessions.size, 1);
  });

  it("recovers a lost session persistence result with identical parameters and key", async () => {
    const f = checkoutFixture(); f.failures.add("write_billing_operation:checkout_saved");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.sessions.size, 1);
    f.failures.clear();
    assert.equal((await f.handler(request())).status, 200);
    const calls = f.createCalls.filter((call) => call.kind === "checkout");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].key, calls[1].key);
    assert.deepEqual(calls[0].params, calls[1].params);
    assert.equal(f.sessions.size, 1);
    assert.equal(f.customers.size, 1);
  });

  it("recovers a lost customer persistence result without creating a second customer", async () => {
    const f = checkoutFixture(); f.failures.add("write_billing_operation:customer_saved");
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(f.customers.size, 1); assert.equal(f.sessions.size, 0);
    f.failures.clear();
    assert.equal((await f.handler(request())).status, 200);
    const calls = f.createCalls.filter((call) => call.kind === "customer");
    assert.equal(calls.length, 2); assert.equal(calls[0].key, calls[1].key);
    assert.deepEqual(calls[0].params, calls[1].params);
    assert.equal(f.customers.size, 1); assert.equal(f.sessions.size, 1);
  });

  it("does not return a portal session when billing ownership reads fail", async () => {
    const f = checkoutFixture(); await f.handler(request());
    f.failures.add("read:subscriptions");
    let portals = 0;
    const portal = loadPost("src/app/api/portal/route.ts", {
      currentUser: async () => ({ id: userId }), adminSupabase: () => f.db,
      stripeClient: () => ({ billingPortal: { sessions: { create: async () => { portals++; return { url: "https://example.invalid" }; } } } }),
      appOrigin: () => input.origin, readBody: async () => ({}), errorResponse, stripeKeyMode, BillingError, z,
      process: { env: { STRIPE_SECRET_KEY: "sk_test_fixture" } },
    });
    assert.equal((await portal(request())).status, 503);
    assert.equal(portals, 0);
  });

  it("does not replace an unknown operation after Stripe's safe retry window", () => {
    assert.throws(() => assertSafeRetry(new Date(Date.now() - 24 * 3600000).toISOString()), /reconciliation/);
    assert.doesNotThrow(() => assertSafeRetry(new Date(Date.now() - 3600000).toISOString()));
  });

  it("refuses another purchase while a subscription is active or has an unresolved payment", async () => {
    for (const status of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]) {
      const f = checkoutFixture();
      await f.handler(request());
      f.subscriptions.push({ id: "sub_current", customer: "cus_fixture1", status, created: 2, livemode: false, metadata: { user_id: userId } });
      assert.equal((await f.handler(request())).status, 409, status);
      assert.equal(f.sessions.size, 1);
    }
  });

  it("an old canceled subscription event cannot replace the active current subscription", async () => {
    const f = checkoutFixture();
    await f.handler(request());
    f.subscriptions.push(
      { id: "sub_new", customer: "cus_fixture1", status: "active", created: 2, livemode: false, metadata: { user_id: userId } },
      { id: "sub_old", customer: "cus_legacy", status: "canceled", created: 1, livemode: false, metadata: { user_id: userId } },
    );
    const webhook = loadPost("src/app/api/stripe/webhook/route.ts", {
      stripeClient: () => f.raw, adminSupabase: () => ({ ...databaseFixture().raw, ...f.db, auth: { admin: { getUserById: async () => ({ data: { user: { id: userId } }, error: null }) } } }),
      errorResponse, acquireBillingLease, billingWrite, reconcileBilling, releaseBillingLease, stripeKeyMode, z,
      process: { env: { STRIPE_WEBHOOK_SECRET: "fixture", STRIPE_SECRET_KEY: "sk_test_fixture" } },
    });
    for (const id of ["sub_new", "sub_old", "sub_old"]) {
      const response = await webhook(new Request("https://example.invalid/webhook", { method: "POST", headers: { "stripe-signature": "fixture" }, body: JSON.stringify({ id: `evt_${id}`, type: "customer.subscription.updated", livemode: false, data: { object: { id } } }) }));
      assert.equal(response.status, 200);
      assert.equal(f.tables.subscriptions[0].subscription_id, "sub_new");
      assert.equal(f.tables.subscriptions[0].status, "active");
    }
    assert.equal(f.tables.billing_customers.length, 2);
    assert.equal(f.tables.stripe_events.length, 2);
  });

  it("fences a stale billing writer once a newer lease has been acquired", async () => {
    const f = checkoutFixture();
    const old = await acquireBillingLease(f.db, userId, false);
    f.tables.billing_accounts[0].lease_expires_at = new Date(Date.now() - 1).toISOString();
    const next = await acquireBillingLease(f.db, userId, false);
    await assert.rejects(() => billingWrite(f.db, old, "customer_saved", { customer_id: "cus_stale" }), /saved safely/);
    await releaseBillingLease(f.db, next);
  });

  it("blocks erasure of an unknown checkout before any provider cancellation", async () => {
    const f = checkoutFixture(); f.failures.add("write_billing_operation:checkout_saved");
    await f.handler(request()); f.failures.clear();
    await assert.rejects(() => prepareBillingErasure(f.db, f.stripe, userId, false, true), (error: unknown) => error instanceof BillingError && error.code === "billing_reconciliation_required");
    assert.equal([...f.sessions.values()][0].status, "open");
    assert.equal(f.customers.size, 1);
  });

  it("account erasure requires cancellation consent and clears open checkouts before deletion", async () => {
    const f = checkoutFixture(); await f.handler(request());
    f.subscriptions.push({ id: "sub_current", customer: "cus_fixture1", status: "active", created: 2, livemode: false, metadata: { user_id: userId } });
    await assert.rejects(() => prepareBillingErasure(f.db, f.stripe, userId, false, false), (error: unknown) => error instanceof BillingError && error.code === "subscription_cancellation_required");
    assert.equal(f.subscriptions[0].status, "active");
    const erasure = await prepareBillingErasure(f.db, f.stripe, userId, false, true);
    assert.equal(f.subscriptions[0].status, "canceled");
    assert.equal([...f.sessions.values()][0].status, "expired");
    assert.equal(f.customers.size, 0);
    await erasure.release();
    // Auth deletion failed after provider cleanup: a second erasure can finish.
    const retry = await prepareBillingErasure(f.db, f.stripe, userId, false, true);
    await retry.release();
  });
});

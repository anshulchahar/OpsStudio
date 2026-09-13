import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertSafeRetry,
  BillingError,
  preferredSubscription,
  subscriptionNeedsAttention,
} from "./billing-policy.ts";

export type BillingDb = Pick<SupabaseClient, "from" | "rpc">;
export type BillingProvider = Pick<Stripe, "customers" | "subscriptions" | "checkout" | "billingPortal">;
export type BillingAccount = {
  user_id: string;
  live_mode: boolean;
  customer_id: string | null;
  customer_started_at: string | null;
};
export type BillingLease = { account: BillingAccount; token: string };
type CheckoutAttempt = {
  id: string;
  customer_id: string;
  session_id: string | null;
  params: Stripe.Checkout.SessionCreateParams;
  status: "pending" | "open" | "complete" | "expired";
  expires_at: string;
  created_at: string;
};

export async function acquireBillingLease(db: BillingDb, userId: string, liveMode: boolean): Promise<BillingLease> {
  const token = randomUUID();
  const { data, error } = await db.rpc("claim_billing_operation", { p_user: userId, p_live: liveMode, p_token: token });
  if (error || !data) throw new BillingError("Billing records could not be checked. Try again later.");
  if (!data.claimed) throw new BillingError("Another billing request is still being checked. Please try again shortly.", 409, "billing_busy");
  return { account: data.account, token };
}

export async function billingWrite<T = unknown>(db: BillingDb, lease: BillingLease, operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc("write_billing_operation", {
    p_user: lease.account.user_id,
    p_live: lease.account.live_mode,
    p_token: lease.token,
    p_operation: operation,
    p_payload: payload,
  });
  if (error || !data) throw new BillingError("Billing could not be saved safely. An earlier request may still be processing; retrying will check it first.");
  return data as T;
}

export async function releaseBillingLease(db: BillingDb, lease: BillingLease) {
  await billingWrite(db, lease, "release");
}

async function ensureCustomer(db: BillingDb, stripe: BillingProvider, lease: BillingLease) {
  if (lease.account.customer_id) return lease.account.customer_id;
  lease.account = await billingWrite<BillingAccount>(db, lease, "customer_started");
  assertSafeRetry(lease.account.customer_started_at!);
  // Parameters and the key remain identical across retries and email changes.
  const customer = await stripe.customers.create(
    { metadata: { user_id: lease.account.user_id } },
    { idempotencyKey: `opsstudio-customer-v1-${lease.account.live_mode}-${lease.account.user_id}` },
  );
  if (customer.livemode !== lease.account.live_mode) throw new BillingError("Billing mode does not match the account.");
  lease.account = await billingWrite<BillingAccount>(db, lease, "customer_saved", { customer_id: customer.id });
  return customer.id;
}

export async function ownedBillingCustomers(db: BillingDb, lease: BillingLease): Promise<string[]> {
  const { data, error } = await db.from("billing_customers").select("customer_id")
    .eq("user_id", lease.account.user_id).eq("live_mode", lease.account.live_mode).limit(11);
  if (error || !data) throw new BillingError("Billing customer ownership could not be checked.");
  if (data.length > 10) throw new BillingError("Billing needs an account review before another operation.", 409, "billing_reconciliation_required");
  return data.map((row) => row.customer_id);
}

export async function currentSubscriptions(stripe: BillingProvider, customerIds: string[]) {
  const subscriptions: Stripe.Subscription[] = [];
  for (const customer of customerIds) {
    const existing = await stripe.customers.retrieve(customer);
    if (existing.deleted) continue;
    let startingAfter: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await stripe.subscriptions.list({ customer, status: "all", limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
      subscriptions.push(...result.data);
      if (!result.has_more) break;
      if (page === 9 || !result.data.length) throw new BillingError("The subscription history needs reconciliation.", 409, "billing_reconciliation_required");
      startingAfter = result.data[result.data.length - 1].id;
    }
  }
  return subscriptions;
}

const customerIdOf = (customer: string | { id: string }) => typeof customer === "string" ? customer : customer.id;

export async function reconcileBilling(db: BillingDb, stripe: BillingProvider, lease: BillingLease, eventId?: string) {
  const customers = await ownedBillingCustomers(db, lease);
  const subscriptions = await currentSubscriptions(stripe, customers);
  const owned = subscriptions.filter((item) => item.metadata.user_id === lease.account.user_id);
  if (owned.some((item) => item.livemode !== lease.account.live_mode)) throw new BillingError("Subscription mode does not match the account.");
  const preferred = preferredSubscription(owned);
  await billingWrite(db, lease, "reconciled", {
    customer_id: preferred ? customerIdOf(preferred.customer) : lease.account.customer_id,
    subscription_id: preferred?.id || null,
    status: preferred?.status || "none",
    event_id: eventId || null,
  });
  return subscriptions;
}

async function persistSession(db: BillingDb, lease: BillingLease, attempt: CheckoutAttempt, session: Stripe.Checkout.Session) {
  if (!session.status || customerIdOf(session.customer || "") !== attempt.customer_id || session.metadata?.attempt_id !== attempt.id || session.livemode !== lease.account.live_mode)
    throw new BillingError("Checkout ownership could not be verified.");
  await billingWrite(db, lease, "checkout_saved", {
    id: attempt.id,
    session_id: session.id,
    status: session.status,
    expires_at: new Date(session.expires_at * 1000).toISOString(),
  });
  return session;
}

export async function recoverCheckout(db: BillingDb, stripe: BillingProvider, lease: BillingLease, attempt: CheckoutAttempt) {
  if (attempt.session_id) return persistSession(db, lease, attempt, await stripe.checkout.sessions.retrieve(attempt.session_id));
  assertSafeRetry(attempt.created_at);
  // A previous response may have been lost. Replay exactly the saved request.
  const session = await stripe.checkout.sessions.create(attempt.params, { idempotencyKey: `opsstudio-checkout-v1-${attempt.id}` });
  return persistSession(db, lease, attempt, session);
}

async function pendingCheckout(db: BillingDb, lease: BillingLease): Promise<CheckoutAttempt | null> {
  const { data, error } = await db.from("billing_checkout_attempts").select("*")
    .eq("user_id", lease.account.user_id).eq("live_mode", lease.account.live_mode).in("status", ["pending", "open"]).maybeSingle();
  if (error) throw new BillingError("The previous checkout could not be checked. Try again later.");
  return data;
}

export async function createOrReuseCheckout(db: BillingDb, stripe: BillingProvider, input: { userId: string; liveMode: boolean; priceId: string; origin: string }) {
  const lease = await acquireBillingLease(db, input.userId, input.liveMode);
  try {
    const customer = await ensureCustomer(db, stripe, lease);
    const subscriptions = await reconcileBilling(db, stripe, lease);
    if (subscriptions.some((item) => subscriptionNeedsAttention(item.status)))
      throw new BillingError("You already have a subscription or an unresolved payment. Use Manage subscription.", 409, "subscription_exists");
    let attempt = await pendingCheckout(db, lease);
    if (attempt) {
      const existing = await recoverCheckout(db, stripe, lease, attempt);
      if (existing.status === "open" && existing.url) return { url: existing.url, reused: true };
      if (existing.status === "complete") throw new BillingError("Your checkout was completed. Check your subscription in Settings.", 409, "checkout_complete");
      if (existing.status !== "expired") throw new BillingError("The previous checkout is still being checked.", 409, "billing_busy");
    }
    const id = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      integration_identifier: "opsstudio_jmrqkzft",
      line_items: [{ price: input.priceId, quantity: 1 }],
      customer,
      client_reference_id: input.userId,
      metadata: { user_id: input.userId, attempt_id: id },
      subscription_data: { metadata: { user_id: input.userId } },
      success_url: `${input.origin}/settings?checkout=success`,
      cancel_url: `${input.origin}/pricing`,
      allow_promotion_codes: true,
      expires_at: expiresAt,
    };
    attempt = await billingWrite<CheckoutAttempt>(db, lease, "checkout_reserved", {
      id, customer_id: customer, params, expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    const session = await recoverCheckout(db, stripe, lease, attempt);
    if (session.status !== "open" || !session.url) throw new BillingError("Checkout is not currently open.");
    return { url: session.url, reused: false };
  } finally {
    await releaseBillingLease(db, lease).catch(() => console.error("billing_lease_release_failed", { userId: input.userId }));
  }
}

export async function prepareBillingErasure(db: BillingDb, stripe: BillingProvider, userId: string, liveMode: boolean, cancelSubscriptions: boolean) {
  const lease = await acquireBillingLease(db, userId, liveMode);
  const release = () => releaseBillingLease(db, lease);
  try {
    if (!lease.account.customer_id && lease.account.customer_started_at)
      throw new BillingError("A customer creation request must be reconciled before deleting the account.", 409, "billing_reconciliation_required");
    // Never create an unresolved checkout while trying to erase an account.
    const pending = await pendingCheckout(db, lease);
    if (pending && !pending.session_id)
      throw new BillingError("A checkout request must be reconciled before deleting the account.", 409, "billing_reconciliation_required");
    const customers = await ownedBillingCustomers(db, lease);
    const subscriptions = await currentSubscriptions(stripe, customers);
    const active = subscriptions.filter((item) => subscriptionNeedsAttention(item.status));
    if (active.length && !cancelSubscriptions)
      throw new BillingError("Confirm cancellation of your existing subscription before deleting the account.", 409, "subscription_cancellation_required");
    // Expire all hosted sessions, including older sessions created before durable
    // attempts were introduced, before cancellation/deletion can proceed.
    for (const customer of customers) {
      if ((await stripe.customers.retrieve(customer)).deleted) continue;
      const sessions = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 });
      if (sessions.has_more) throw new BillingError("Open checkouts need an account review.", 409, "billing_reconciliation_required");
      for (const session of sessions.data) {
        await stripe.checkout.sessions.expire(session.id);
      }
    }
    if (pending) await recoverCheckout(db, stripe, lease, pending);
    // Re-list after session expiry: a session could have completed during the
    // first read, and its subscription must also be explicitly canceled.
    const remaining = (await currentSubscriptions(stripe, customers)).filter((item) => subscriptionNeedsAttention(item.status));
    if (remaining.length && !cancelSubscriptions)
      throw new BillingError("Confirm cancellation of your existing subscription before deleting the account.", 409, "subscription_cancellation_required");
    for (const subscription of remaining) {
      const result = await stripe.subscriptions.cancel(subscription.id);
      if (result.status !== "canceled") throw new BillingError("Subscription cancellation could not be confirmed.");
    }
    if ((await currentSubscriptions(stripe, customers)).some((item) => subscriptionNeedsAttention(item.status)))
      throw new BillingError("Subscription cancellation is still being confirmed. Try again later.", 409, "billing_reconciliation_required");
    await billingWrite(db, lease, "reconciled", { customer_id: lease.account.customer_id, subscription_id: null, status: "canceled" });
    for (const customer of customers) {
      if (!(await stripe.customers.retrieve(customer)).deleted) await stripe.customers.del(customer);
    }
    return { release };
  } catch (error) {
    await release().catch(() => {});
    throw error;
  }
}

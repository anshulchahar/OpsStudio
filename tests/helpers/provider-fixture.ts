import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import type { BillingDb, BillingProvider } from "../../src/lib/billing-runtime.ts";

export function loadPost(relative: string, dependencies: Record<string, unknown>): (request: Request) => Promise<Response> {
  const code = stripTypeScriptTypes(readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8"), { mode: "transform" })
    .replace(/^import[\s\S]*?;\s*/gm, "").replace(/^export /gm, "");
  return new Function(...Object.keys(dependencies), `${code}; return POST;`)(...Object.values(dependencies));
}
export const userId = "11111111-1111-4111-8111-111111111111";
export type Row = Record<string, unknown>;
export function databaseFixture() {
  const tables: Record<string, Row[]> = { billing_accounts: [], billing_customers: [], billing_checkout_attempts: [], subscriptions: [], stripe_events: [], ai_generations: [], lab_runs: [] };
  const failures = new Set<string>();
  let reservations = 0;
  class Query {
    table: string;
    filters: ((row: Row) => boolean)[] = [];
    patch: Row | null = null;
    maximum = Infinity;
    constructor(table: string) { this.table = table; }
    select() { return this; }
    eq(key: string, value: unknown) { this.filters.push((row) => row[key] === value); return this; }
    neq(key: string, value: unknown) { this.filters.push((row) => row[key] !== value); return this; }
    gt(key: string, value: string) { this.filters.push((row) => String(row[key]) > value); return this; }
    in(key: string, value: unknown[]) { this.filters.push((row) => value.includes(row[key])); return this; }
    limit(value: number) { this.maximum = value; return this; }
    order() { return this; }
    update(value: Row) { this.patch = value; return this; }
    async upsert(value: Row) {
      if (failures.has(`write:${this.table}`)) return { error: { message: "unavailable" } };
      const row = tables[this.table].find((item) => item.id === value.id);
      if (row) Object.assign(row, value); else tables[this.table].push(value);
      return { error: null };
    }
    execute(single = false) {
      if (failures.has(`read:${this.table}`) || (this.patch && failures.has(`write:${this.table}`))) return { data: null, error: { message: "unavailable" } };
      const rows = (tables[this.table] || []).filter((row) => this.filters.every((filter) => filter(row))).slice(0, this.maximum);
      if (this.patch) rows.forEach((row) => Object.assign(row, this.patch));
      return { data: single ? rows[0] || null : rows, error: null };
    }
    async maybeSingle() { return this.execute(true); }
    then(resolve: (result: ReturnType<Query["execute"]>) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(this.execute()).then(resolve, reject); }
  }
  const db = {
    auth: { admin: { getUserById: async () => ({ data: { user: { id: userId } }, error: null }) } },
    from: (table: string) => new Query(table),
    async rpc(name: string, p: Row) {
      if (failures.has(name) || failures.has(`${name}:${p.p_operation}`)) return { data: null, error: { message: "unavailable" } };
      if (name === "claim_lab_run") {
        if (reservations >= Number(p.p_user_limit)) return { data: { status: "quota" }, error: null };
        reservations++;
        tables.lab_runs.push({ id: p.p_id, user_id: p.p_user, recipe: p.p_recipe, status: "pending", lease_expires_at: new Date(Date.now() + 120000).toISOString() });
        return { data: { status: "claimed", id: p.p_id, remaining: Number(p.p_user_limit) - reservations }, error: null };
      }
      if (name === "claim_mentor_generation") {
        const matching = tables.ai_generations.filter((row) => row.user_id === p.p_user && row.cache_key === p.p_cache);
        const complete = matching.find((row) => row.status === "complete" && Date.parse(String(row.created_at)) > Date.now() - 86400000);
        if (complete) return { data: { status: "cached", id: complete.id, answer: complete.answer }, error: null };
        const pending = matching.find((row) => row.status === "pending" && Date.parse(String(row.lease_expires_at)) > Date.now());
        if (pending) return { data: { status: "pending", id: pending.id }, error: null };
        matching.filter((row) => row.status === "pending").forEach((row) => Object.assign(row, { status: "error", error_category: "lease_expired" }));
        if (reservations >= Number(p.p_user_limit)) return { data: { status: "quota" }, error: null };
        reservations++;
        tables.ai_generations.push({ id: p.p_id, user_id: p.p_user, cache_key: p.p_cache, status: "pending", created_at: new Date().toISOString(), lease_expires_at: new Date(Date.now() + 120000).toISOString(), usage_known: false, estimated_usd: null });
        return { data: { status: "claimed", id: p.p_id, remaining: Number(p.p_user_limit) - reservations }, error: null };
      }
      let account = tables.billing_accounts.find((row) => row.user_id === p.p_user && row.live_mode === p.p_live);
      if (name === "claim_billing_operation") {
        if (!account) { account = { user_id: p.p_user, live_mode: p.p_live, customer_id: null, customer_started_at: null }; tables.billing_accounts.push(account); }
        if (account.lease_token && Date.parse(String(account.lease_expires_at)) > Date.now()) return { data: { claimed: false }, error: null };
        Object.assign(account, { lease_token: p.p_token, lease_expires_at: new Date(Date.now() + 120000).toISOString() });
        return { data: { claimed: true, account: { ...account } }, error: null };
      }
      if (name !== "write_billing_operation" || !account || account.lease_token !== p.p_token || Date.parse(String(account.lease_expires_at)) <= Date.now()) return { data: null, error: { message: "lease expired" } };
      const value = p.p_payload as Row;
      if (p.p_operation === "release") account.lease_token = null;
      if (p.p_operation === "customer_started") account.customer_started_at ||= new Date().toISOString();
      if (["customer_saved", "register_customer"].includes(String(p.p_operation))) {
        const existing = tables.billing_customers.find((row) => row.customer_id === value.customer_id && row.live_mode === p.p_live);
        if (existing && existing.user_id !== p.p_user) return { data: null, error: { message: "owner conflict" } };
        if (!existing) tables.billing_customers.push({ customer_id: value.customer_id, user_id: p.p_user, live_mode: p.p_live });
        account.customer_id ||= value.customer_id;
      }
      if (p.p_operation === "checkout_reserved") {
        const row = { ...value, user_id: p.p_user, live_mode: p.p_live, session_id: null, status: "pending", created_at: new Date().toISOString() };
        tables.billing_checkout_attempts.push(row);
        return { data: { ...row }, error: null };
      }
      if (p.p_operation === "checkout_saved") {
        const row = tables.billing_checkout_attempts.find((item) => item.id === value.id)!;
        Object.assign(row, value);
        return { data: { ...row }, error: null };
      }
      if (p.p_operation === "reconciled") {
        const row = tables.subscriptions.find((item) => item.user_id === p.p_user);
        const subscription = { ...value, user_id: p.p_user, live_mode: p.p_live };
        if (row) Object.assign(row, subscription); else tables.subscriptions.push(subscription);
        if (value.event_id) tables.stripe_events.push({ id: value.event_id });
      }
      return { data: { ...account, ok: true }, error: null };
    },
  };
  return { db: db as unknown as BillingDb, raw: db, tables, failures, reservations: () => reservations };
}

export function stripeFixture() {
  const customers = new Map<string, Row>();
  const deletedCustomers = new Set<string>();
  const sessions = new Map<string, Row>();
  const subscriptions: Row[] = [];
  const createCalls: { kind: string; params: Row; key: string }[] = [];
  const keys = new Map<string, Row>();
  const stripe = {
    customers: {
      async create(params: Row, options: { idempotencyKey: string }) {
        createCalls.push({ kind: "customer", params, key: options.idempotencyKey });
        if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
        const customer = { id: `cus_fixture${customers.size + 1}`, livemode: false, ...params };
        customers.set(customer.id, customer); keys.set(options.idempotencyKey, customer); return customer;
      },
      async retrieve(id: string) { return deletedCustomers.has(id) ? { id, deleted: true } : customers.get(id) || { id, livemode: false }; },
      async del(id: string) { deletedCustomers.add(id); customers.delete(id); return { id, deleted: true }; },
    },
    subscriptions: {
      async retrieve(id: string) { return subscriptions.find((item) => item.id === id); },
      async list(params: Row) { return { data: subscriptions.filter((item) => item.customer === params.customer), has_more: false }; },
      async cancel(id: string) { const item = subscriptions.find((row) => row.id === id)!; item.status = "canceled"; return item; },
    },
    checkout: { sessions: {
      async create(params: Row, options: { idempotencyKey: string }) {
        createCalls.push({ kind: "checkout", params, key: options.idempotencyKey });
        if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
        const session = { id: `cs_fixture${sessions.size + 1}`, url: "https://checkout.stripe.test/fixture", status: "open", livemode: false, ...params };
        sessions.set(session.id, session); keys.set(options.idempotencyKey, session); return session;
      },
      async retrieve(id: string) { return sessions.get(id); },
      async list(params: Row) { return { data: [...sessions.values()].filter((item) => item.customer === params.customer && item.status === params.status), has_more: false }; },
      async expire(id: string) { const session = sessions.get(id)!; session.status = "expired"; return session; },
    } },
    webhooks: { constructEvent: (raw: string) => JSON.parse(raw) },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/fixture" }) } },
  };
  return { stripe: stripe as unknown as BillingProvider, raw: stripe, customers, sessions, subscriptions, createCalls };
}

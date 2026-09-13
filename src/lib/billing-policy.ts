export class BillingError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 503, code = "billing_unavailable") {
    super(message);
    this.name = "BillingError";
    this.status = status;
    this.code = code;
  }
}

export function stripeKeyMode(key: string | undefined): "test" | "live" {
  if (/^(?:sk|rk)_test_.+/.test(key || "")) return "test";
  if (/^(?:sk|rk)_live_.+/.test(key || "")) return "live";
  throw new BillingError("Subscription billing is not configured.");
}

export function assertPaymentsEnabled(key: string | undefined, enabled: string | undefined) {
  const mode = stripeKeyMode(key);
  if (mode === "live" && enabled !== "true")
    throw new BillingError("Live payments have not been enabled for this release.");
  return mode;
}

export const subscriptionNeedsAttention = (status: string) =>
  !["canceled", "incomplete_expired"].includes(status);

type SubscriptionState = { id: string; status: string; created: number };
export function preferredSubscription<T extends SubscriptionState>(items: T[]): T | null {
  const rank = (status: string) => status === "active" ? 0 : status === "trialing" ? 1 : subscriptionNeedsAttention(status) ? 2 : 3;
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || b.created - a.created || a.id.localeCompare(b.id))[0] || null;
}

// Stripe retains idempotency results for at least 24 hours. Never recreate an
// unresolved external operation once its safe retry window has elapsed.
export function assertSafeRetry(createdAt: string, now = Date.now()) {
  if (!Number.isFinite(Date.parse(createdAt)) || now - Date.parse(createdAt) >= 23 * 3600000)
    throw new BillingError("An earlier billing request needs reconciliation. Contact support before opening another checkout.", 409, "billing_reconciliation_required");
}

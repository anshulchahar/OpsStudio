import "server-only";
import Stripe from "stripe";
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Subscription checkout is not configured.");
  if (key.startsWith("sk_live_") && process.env.BILLING_LIVE_ENABLED !== "true")
    throw new Error("Live payments have not been enabled for this release.");
  return new Stripe(key, { maxNetworkRetries: 0, timeout: 15000 });
}

import "server-only";
import Stripe from "stripe";
import { assertPaymentsEnabled, stripeKeyMode } from "./billing-policy";
export function stripeClient(options: { allowLiveManagement?: boolean } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (options.allowLiveManagement) stripeKeyMode(key);
  else assertPaymentsEnabled(key, process.env.BILLING_LIVE_ENABLED);
  return new Stripe(key!, { maxNetworkRetries: 0, timeout: 10000 });
}

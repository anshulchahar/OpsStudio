import "server-only";
import { adminSupabase } from "./supabase/server";
import { stripeClient } from "./stripe";
import { BillingError, stripeKeyMode } from "./billing-policy";
import { prepareBillingErasure } from "./billing-runtime";
export { BillingError } from "./billing-policy";

export async function prepareAccountBillingErasure(userId: string, options: { cancelSubscriptions: boolean }): Promise<{ release: () => Promise<void> }> {
  const db = adminSupabase();
  const { data: accounts, error } = await db.from("billing_accounts").select("live_mode,customer_id,customer_started_at").eq("user_id", userId);
  if (error || !accounts) throw new BillingError("Billing ownership could not be checked before deletion.");
  const hasBilling = accounts.some((account) => account.customer_id || account.customer_started_at);
  if (!process.env.STRIPE_SECRET_KEY && !hasBilling) return { release: async () => {} };
  const liveMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY) === "live";
  if (accounts.some((account) => account.live_mode !== liveMode && (account.customer_id || account.customer_started_at)))
    throw new BillingError("Billing records in another payment environment need reconciliation before deletion.", 409, "billing_reconciliation_required");
  return prepareBillingErasure(db, stripeClient({ allowLiveManagement: true }), userId, liveMode, options.cancelSubscriptions);
}

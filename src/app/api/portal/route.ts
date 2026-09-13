import { currentUser, adminSupabase } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/stripe";
import { stripeKeyMode, BillingError } from "@/lib/billing-policy";
import { appOrigin, readBody, errorResponse } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return errorResponse("Sign in to manage a subscription.", 401);
  try {
    await readBody(request, z.object({}), 2048);
  } catch {
    return errorResponse("Invalid portal request.");
  }
  try {
    const liveMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY) === "live";
    const db = adminSupabase();
    const { data: subscription, error: subscriptionError } = await db.from("subscriptions")
      .select("customer_id").eq("user_id", user.id).eq("live_mode", liveMode).maybeSingle();
    if (subscriptionError) throw new BillingError("Billing ownership could not be checked.");
    const { data: account, error: accountError } = await db.from("billing_accounts")
      .select("customer_id").eq("user_id", user.id).eq("live_mode", liveMode).maybeSingle();
    if (accountError) throw new BillingError("Billing ownership could not be checked.");
    const customer = subscription?.customer_id || account?.customer_id;
    if (!customer) return errorResponse("There is no subscription to manage yet.", 404);
    const { data: owned, error: ownershipError } = await db.from("billing_customers")
      .select("customer_id").eq("user_id", user.id).eq("live_mode", liveMode).eq("customer_id", customer).maybeSingle();
    if (ownershipError || !owned) throw new BillingError("Billing ownership could not be verified.");
    // Management stays available when new live purchases are paused.
    const session = await stripeClient({ allowLiveManagement: true }).billingPortal.sessions.create({
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
      customer,
      return_url: `${appOrigin()}/settings`,
    });
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("The subscription portal is temporarily unavailable.", 503);
  }
}

import { stripeClient } from "@/lib/stripe";
import { adminSupabase } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";
import { acquireBillingLease, billingWrite, reconcileBilling, releaseBillingLease } from "@/lib/billing-runtime";
import { stripeKeyMode } from "@/lib/billing-policy";
import type Stripe from "stripe";
import { z } from "zod";

export const maxDuration = 60;
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return errorResponse("Webhook signature unavailable.", 400);
  let event: Stripe.Event;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 262144) return errorResponse("Webhook payload is too large.", 413);
    event = stripeClient({ allowLiveManagement: true }).webhooks.constructEvent(raw, signature, secret);
    if (event.livemode !== (stripeKeyMode(process.env.STRIPE_SECRET_KEY) === "live"))
      return errorResponse("Webhook environment does not match.", 400);
  } catch {
    return errorResponse("Invalid webhook signature.", 400);
  }
  try {
    const db = adminSupabase();
    const { data: seen, error: lookupError } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (seen) return Response.json({ received: true });
    if (event.type.startsWith("customer.subscription.")) {
      const stripe = stripeClient({ allowLiveManagement: true });
      const payload = event.data.object as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(payload.id);
      const userId = subscription.metadata.user_id;
      if (z.string().uuid().safeParse(userId).success) {
        const { data: userData, error: userError } = await db.auth.admin.getUserById(userId);
        // Account erasure can legitimately precede Stripe's delayed deletion event.
        if (userError && userError.status !== 404) throw userError;
        if (userData.user) {
          const lease = await acquireBillingLease(db, userId, event.livemode);
          try {
            const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
            lease.account = await billingWrite(db, lease, "register_customer", { customer_id: customer });
            // Read every currently owned subscription under the same fenced lease.
            // An old canceled subscription or another customer's delayed event cannot
            // overwrite a newer active subscription's entitlement.
            await reconcileBilling(db, stripe, lease, event.id);
          } finally {
            await releaseBillingLease(db, lease).catch(() => {});
          }
          return Response.json({ received: true });
        }
      }
    }
    const { error } = await db.from("stripe_events").upsert({ id: event.id }, { onConflict: "id" });
    if (error) throw error;
    return Response.json({ received: true });
  } catch {
    return errorResponse("Webhook processing failed; retry is safe.", 500);
  }
}

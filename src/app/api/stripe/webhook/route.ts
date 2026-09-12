import { stripeClient } from "@/lib/stripe";
import { adminSupabase } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";
import type Stripe from "stripe";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return errorResponse("Webhook signature unavailable.", 400);
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return errorResponse("Invalid webhook signature.", 400);
  }
  const db = adminSupabase();
  const { data: seen } = await db
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return Response.json({ received: true });
  try {
    if (event.type.startsWith("customer.subscription.")) {
      const payload = event.data.object as Stripe.Subscription;
      // Fetch current state so a delayed older event cannot overwrite the latest state.
      const subscription = await stripeClient().subscriptions.retrieve(
        payload.id,
      );
      const userId = subscription.metadata.user_id;
      if (userId) {
        const { error } = await db
          .from("subscriptions")
          .upsert({
            user_id: userId,
            customer_id:
              typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer.id,
            subscription_id: subscription.id,
            status: subscription.status,
            live_mode: event.livemode,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    }
    const { error } = await db
      .from("stripe_events")
      .upsert({ id: event.id }, { onConflict: "id" });
    if (error) throw error;
    return Response.json({ received: true });
  } catch {
    return errorResponse("Webhook processing failed; retry is safe.", 500);
  }
}

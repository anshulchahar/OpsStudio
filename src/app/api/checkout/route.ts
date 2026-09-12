import { currentUser, adminSupabase } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/stripe";
import { appOrigin, readBody, errorResponse } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return errorResponse("Sign in before choosing a plan.", 401);
  try {
    await readBody(request, z.object({}), 2048);
  } catch {
    return errorResponse("Invalid checkout request.");
  }
  if (!process.env.STRIPE_PRICE_ID)
    return errorResponse(
      "Paid plans are not open yet. All launch missions remain available during the beta.",
      503,
    );
  try {
    const stripe = stripeClient();
    const db = adminSupabase();
    const { data: subscription } = await db
      .from("subscriptions")
      .select("customer_id,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscription && ["active", "trialing"].includes(subscription.status))
      return errorResponse(
        "You already have a subscription. Use Manage subscription.",
        409,
      );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        integration_identifier: "opsstudio_jmrqkzft",
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        client_reference_id: user.id,
        metadata: { user_id: user.id },
        subscription_data: { metadata: { user_id: user.id } },
        ...(subscription?.customer_id
          ? { customer: subscription.customer_id }
          : { customer_email: user.email }),
        success_url: `${appOrigin()}/settings?checkout=success`,
        cancel_url: `${appOrigin()}/pricing`,
        allow_promotion_codes: true,
      },
      {
        idempotencyKey: `checkout-${user.id}-${Math.floor(Date.now() / 60000)}`,
      },
    );
    return Response.json({ url: session.url });
  } catch {
    return errorResponse(
      "Checkout could not open. No subscription has been created by OpsStudio.",
      503,
    );
  }
}

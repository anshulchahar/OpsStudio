import { currentUser, adminSupabase } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/stripe";
import { appOrigin, readBody, errorResponse } from "@/lib/http";
import { assertPaymentsEnabled, BillingError } from "@/lib/billing-policy";
import { createOrReuseCheckout } from "@/lib/billing-runtime";
import { operatorDetails } from "@/lib/operator";
import { z } from "zod";

export const maxDuration = 60;
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return errorResponse("Sign in before choosing a plan.", 401);
  try {
    await readBody(request, z.object({}), 2048);
  } catch {
    return errorResponse("Invalid checkout request.");
  }
  if (!process.env.STRIPE_PRICE_ID)
    return errorResponse("Paid plans are not open yet. The project portfolio remains available during the beta.", 503);
  try {
    const liveMode = assertPaymentsEnabled(process.env.STRIPE_SECRET_KEY, process.env.BILLING_LIVE_ENABLED) === "live";
    if (liveMode && !operatorDetails().configured)
      return errorResponse("Paid plans will open after the operator details have been published.", 503);
    const result = await createOrReuseCheckout(adminSupabase(), stripeClient(), {
      userId: user.id,
      liveMode,
      priceId: process.env.STRIPE_PRICE_ID,
      origin: appOrigin(),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(
      error instanceof BillingError ? error.message : "Checkout is temporarily unavailable. An earlier request may still be processing; retrying will check it first.",
      error instanceof BillingError ? error.status : 503,
    );
  }
}

import { currentUser, adminSupabase } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/stripe";
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
  const { data } = await adminSupabase()
    .from("subscriptions")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data)
    return errorResponse("There is no subscription to manage yet.", 404);
  try {
    const session = await stripeClient().billingPortal.sessions.create({
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
      customer: data.customer_id,
      return_url: `${appOrigin()}/settings`,
    });
    return Response.json({ url: session.url });
  } catch {
    return errorResponse(
      "The subscription portal is temporarily unavailable.",
      503,
    );
  }
}

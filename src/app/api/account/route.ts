import { adminSupabase, currentUser } from "@/lib/supabase/server";
import { errorResponse, integerEnv } from "@/lib/http";
export async function GET() {
  const user = await currentUser();
  if (!user) return errorResponse("Sign in to view your account.", 401);
  const db = adminSupabase();
  const day = new Date().toISOString().slice(0, 10);
  const [usage, subscription] = await Promise.all([
    db
      .from("usage_buckets")
      .select("kind,used")
      .eq("scope", user.id)
      .eq("day", day),
    db
      .from("subscriptions")
      .select("status,live_mode")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (usage.error || subscription.error)
    return errorResponse("Account details are temporarily unavailable.", 503);
  return Response.json(
    {
      usage: usage.data,
      limits: {
        mentor: integerEnv("AI_USER_DAILY_LIMIT", 8),
        lab: integerEnv("LAB_USER_DAILY_LIMIT", 2),
      },
      subscription: subscription.data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

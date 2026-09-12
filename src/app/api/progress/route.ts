import { serverSupabase } from "@/lib/supabase/server";
import { savedProgressSchema } from "@/lib/engine";
import { readBody, errorResponse } from "@/lib/http";
export async function GET() {
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return errorResponse("Sign in to sync your progress.", 401);
  const { data, error } = await db
    .from("learner_progress")
    .select("payload")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return errorResponse(
      "Your saved progress could not be loaded. Please try again.",
      503,
    );
  return Response.json(
    { progress: data?.payload ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(request: Request) {
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return errorResponse("Sign in to sync your progress.", 401);
  let payload;
  try {
    payload = await readBody(request, savedProgressSchema, 131072);
  } catch {
    return errorResponse("The saved progress is invalid.");
  }
  const { error } = await db.rpc("save_progress", { p_payload: payload });
  if (error)
    return errorResponse(
      "Your work is saved on this device, but cloud sync failed.",
      503,
    );
  return Response.json({ saved: true });
}

import { serverSupabase } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return errorResponse("Answer not found.", 404);
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return errorResponse("Sign in to read your saved answer.", 401);
  const { data, error } = await db
    .from("ai_generations")
    .select("id,answer,mission_id,created_at,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return errorResponse("Answer not found.", 404);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

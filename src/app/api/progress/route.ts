import { serverSupabase } from "@/lib/supabase/server";
import { readBody, errorResponse } from "@/lib/http";
import { PROGRESS_MAX_BYTES, progressWriteSchema } from "@/lib/progress-sync";

export async function GET(request: Request) {
  try {
    const db = await serverSupabase();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return errorResponse("Sign in to sync your progress.", 401);
    if (request.headers.get("x-opsstudio-principal") !== user.id) return errorResponse("Your account changed. Reload before syncing.", 403);
    const { data, error } = await db.from("learner_progress").select("payload,revision").eq("user_id", user.id).maybeSingle();
    if (error) return errorResponse("Your saved progress could not be loaded. Please try again.", 503);
    return Response.json({ progress: data?.payload ?? null, revision: data?.revision ?? 0, userId: user.id }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Progress sync is temporarily unavailable.", 503); }
}
export async function PUT(request: Request) {
  try {
    const db = await serverSupabase();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return errorResponse("Sign in to sync your progress.", 401);
    let body;
    try { body = await readBody(request, progressWriteSchema, PROGRESS_MAX_BYTES + 4096); }
    catch { return errorResponse("The saved progress is invalid or exceeds the 2 MiB limit."); }
    if (body.expectedUserId !== user.id) return errorResponse("Your account changed. Reload before syncing.", 403);
    const { data, error } = await db.rpc("save_progress", { p_payload: body.progress, p_expected_revision: body.expectedRevision });
    if (error || !data || !Number.isSafeInteger(data.revision)) return errorResponse("Your work is saved on this device, but cloud sync failed.", 503);
    return Response.json({ saved: data.saved, progress: data.payload, revision: data.revision, userId: user.id }, { status: data.saved ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Progress sync is temporarily unavailable.", 503); }
}

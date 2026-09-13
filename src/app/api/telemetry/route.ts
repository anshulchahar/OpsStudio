import { z } from "zod";
import { readBody, errorResponse } from "@/lib/http";
import { adminSupabase, currentUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Anonymous errors still appear in the browser console; accepting arbitrary public
  // telemetry would turn monitoring into an unbounded anonymous write API.
  const user = await currentUser();
  if (!user) return errorResponse("Sign in required.", 401);
  try {
    const { kind } = await readBody(request, z.object({ kind: z.enum(["runtime", "promise"]) }), 256);
    const { error } = await adminSupabase().rpc("record_browser_error", { p_kind: kind })
      .abortSignal(AbortSignal.timeout(3000));
    if (error) return errorResponse("Monitoring unavailable.", 503);
    return new Response(null, { status: 204 });
  } catch { return errorResponse("Invalid report."); }
}

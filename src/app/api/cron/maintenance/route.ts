import { adminSupabase } from "@/lib/supabase/server";
import { authorizedJob, recordOperation } from "@/lib/operations";
import { retentionDays } from "@/lib/operator";

export const maxDuration = 30;
export async function GET(request: Request) {
  if (!authorizedJob(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const days = retentionDays();
    const { data, error } = await adminSupabase().rpc("maintain_operations", {
      p_ai_days: days.ai, p_lab_days: days.labs, p_usage_days: days.usage,
      p_event_days: days.billingEvents, p_operation_days: days.operations,
    })
      .abortSignal(AbortSignal.timeout(20000));
    if (error) throw new Error("MAINTENANCE_FAILED");
    await recordOperation("maintenance", "ok", "CLEANUP_COMPLETE");
    return Response.json({ status: "ok", cleaned: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await recordOperation("maintenance", "error", "MAINTENANCE_FAILED");
    return Response.json({ error: "Maintenance failed" }, { status: 503 });
  }
}

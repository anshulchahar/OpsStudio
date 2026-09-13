import { authorizedJob, recordOperation } from "@/lib/operations";

export async function POST(request: Request) {
  if (!authorizedJob(request, "MONITOR_SECRET")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const recorded = await recordOperation("backup", "ok", "ENCRYPTED_OFFSITE_UPLOAD_COMPLETE");
  if (!recorded) return Response.json({ error: "Backup freshness could not be recorded" }, { status: 503 });
  return Response.json({ recorded: true }, { headers: { "Cache-Control": "no-store" } });
}

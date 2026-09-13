import { adminSupabase } from "@/lib/supabase/server";
import { authorizedJob } from "@/lib/operations";
import { releaseSources } from "@/lib/release-catalog";
import { releaseFreshness } from "@/lib/release-freshness";

export const maxDuration = 15;
export async function GET(request: Request) {
  if (!authorizedJob(request, "MONITOR_SECRET"))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let checks = { database: false, auth: false, catalog: false, maintenance: false, backup: false };
  try {
    const db = adminSupabase();
    const [catalog, jobs, auth] = await Promise.all([
      db.from("release_catalog").select("id,checked_at").abortSignal(AbortSignal.timeout(5000)),
      db.from("operational_checks").select("id,status,checked_at").in("id", ["maintenance", "backup", ...releaseSources.map(source => `release:${source.id}`)]).abortSignal(AbortSignal.timeout(5000)),
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        cache: "no-store", signal: AbortSignal.timeout(5000),
      }),
    ]);
    const recentSuccess = (id: string) => {
      const check = jobs.data?.find(row => row.id === id);
      return !jobs.error && !!check && !releaseFreshness(check.checked_at, check.status !== "ok").stale;
    };
    checks = {
      database: !catalog.error && !jobs.error,
      auth: auth.ok,
      catalog: !catalog.error && releaseSources.every(source => recentSuccess(`release:${source.id}`) && !releaseFreshness(catalog.data?.find(row => row.id === source.id)?.checked_at, false).stale),
      maintenance: recentSuccess("maintenance"),
      backup: recentSuccess("backup"),
    };
  } catch { /* The response exposes booleans only. */ }
  const ready = Object.values(checks).every(Boolean);
  return Response.json({ status: ready ? "ready" : "degraded", checks }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

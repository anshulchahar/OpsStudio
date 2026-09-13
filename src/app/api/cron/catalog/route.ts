import { adminSupabase } from "@/lib/supabase/server";
import { releaseSources, fetchRelease } from "@/lib/release-catalog";
import { authorizedJob, recordOperation } from "@/lib/operations";
export const maxDuration = 30;
export async function GET(request: Request) {
  if (!authorizedJob(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = adminSupabase();
  const results = await Promise.allSettled(
    releaseSources.map(async (source) => {
      try {
        const release = await fetchRelease(source);
        const { error } = await db.from("release_catalog").upsert(release).abortSignal(AbortSignal.timeout(5000));
        if (error) throw new Error("Could not persist release");
        await recordOperation(`release:${source.id}`, "ok", "SOURCE_VERIFIED");
        return source.id;
      } catch {
        await recordOperation(`release:${source.id}`, "error", "SOURCE_REFRESH_FAILED");
        throw new Error("Source refresh failed");
      }
    }),
  );
  const failed = results.flatMap((r, i) =>
    r.status === "rejected" ? [releaseSources[i].id] : [],
  );
  return Response.json(
    { updated: results.length - failed.length, failed, aiCalls: 0 },
    { status: failed.length ? 502 : 200 },
  );
}

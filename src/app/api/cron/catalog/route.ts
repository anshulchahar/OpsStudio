import { timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/server";
import { releaseSources, fetchRelease } from "@/lib/release-catalog";
export const maxDuration = 30;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Disabled" }, { status: 503 });
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = adminSupabase();
  const results = await Promise.allSettled(
    releaseSources.map(async (source) => {
      const release = await fetchRelease(source);
      const { error } = await db.from("release_catalog").upsert(release);
      if (error) throw new Error("Could not persist release");
      return source.id;
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

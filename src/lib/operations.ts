import "server-only";
import { timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/server";

export function authorizedJob(request: Request, name = "CRON_SECRET") {
  const secret = process.env[name];
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Deliberately accept codes, never exception messages, prompts, URLs or headers.
export async function recordOperation(id: string, status: "ok" | "error", code: string) {
  const entry = { id, status, code, checked_at: new Date().toISOString() };
  const log = JSON.stringify({ service: "OpsStudio", ...entry });
  if (status === "error") console.error(log);
  else console.info(log);
  try {
    const { error } = await adminSupabase().from("operational_checks").upsert(entry)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) {
      console.error(JSON.stringify({ service: "OpsStudio", code: "CHECK_STORAGE_UNAVAILABLE" }));
      return false;
    }
    return true;
  } catch {
    console.error(JSON.stringify({ service: "OpsStudio", code: "CHECK_STORAGE_UNAVAILABLE" }));
    return false;
  }
}

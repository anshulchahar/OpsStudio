import { createClient } from "@supabase/supabase-js";
import { appOrigin, errorResponse, readBody } from "@/lib/http";
import { changeRequestPassword, passwordUpdateSchema } from "@/lib/password-actions";

export const maxDuration = 30;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || (origin !== new URL(request.url).origin && origin !== appOrigin())) return errorResponse("This request origin is not permitted.", 403);
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token) return errorResponse("Your recovery session is missing. Request another recovery link.", 401);
  let input;
  try { input = await readBody(request, passwordUpdateSchema, 8192); }
  catch { return errorResponse("Send the current account and a password of 10–1024 characters as a JSON request.", 400); }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return errorResponse("Password recovery is temporarily unavailable.", 503);
    // Bind to the explicitly captured token, never mutable browser storage or
    // cookies. This client cannot emit Set-Cookie for a previous browser account.
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (target, init) => fetch(target, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) }) },
    });
    const result = await changeRequestPassword(input, {
      getUser: () => db.auth.getUser(token),
      updateUser: async attributes => {
        // Use the same verified bearer directly. The browser SDK's updateUser
        // instead rereads mutable storage; an Admin update would bypass Auth's
        // normal password/recovery policy. This calls the regular Auth endpoint.
        const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
          method: "PUT", headers: { apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(attributes), signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return { data: { user: null }, error: new Error("Password update rejected") };
        const result = await response.json();
        const user = result?.user ?? result;
        return typeof user?.id === "string" ? { data: { user: { id: user.id } }, error: null } : { data: { user: null }, error: new Error("Invalid Auth response") };
      },
    });
    if (!result.ok) return errorResponse(result.message, result.status);
    return Response.json({ updated: true, userId: result.userId }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Password recovery is temporarily unavailable. Please try again.", 503); }
}

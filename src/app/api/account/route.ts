import { createClient } from "@supabase/supabase-js";
import { adminSupabase, currentUser, serverSupabase } from "@/lib/supabase/server";
import { errorResponse, integerEnv, readBody } from "@/lib/http";
import { accountDeletionSchema, AccountActionError, collectExportPages, encodeAccountExport, eraseAccount, publicAccountIdentity } from "@/lib/account-actions";
import { BillingError, prepareAccountBillingErasure } from "@/lib/billing";

export const maxDuration = 60;

function accountError(error: unknown) {
  if (error instanceof AccountActionError || error instanceof BillingError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  return errorResponse("The account service is temporarily unavailable. Please try again.", 503);
}

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return errorResponse("Sign in to view your account.", 401);
    const params = new URL(request.url).searchParams;
    const expectedUserId = params.get("expectedUserId");
    if (expectedUserId && expectedUserId !== user.id) return errorResponse("Your signed-in account changed. Reload your settings.", 409);
    const db = adminSupabase();
    if (params.get("export") === "1") {
      if (expectedUserId !== user.id) return errorResponse("Confirm the current account before exporting.", 409);
      // Select explicit fields. Authentication secrets, billing lease tokens and
      // provider request parameters are never part of a portable user export.
      const exportedAt = new Date().toISOString();
      const [progress, answers, labs, usage, subscription, accounts, customers, checkouts] = await Promise.all([
        collectExportPages((from, to) => db.from("learner_progress").select("payload,updated_at,revision").eq("user_id", user.id).order("user_id").range(from, to)),
        collectExportPages((from, to) => db.from("ai_generations").select("id,mission_id,model,prompt,answer,status,input_tokens,output_tokens,estimated_usd,usage_known,error_category,finish_reason,created_at,finished_at,lease_expires_at").eq("user_id", user.id).lte("created_at", exportedAt).order("created_at").order("id").range(from, to)),
        collectExportPages((from, to) => db.from("lab_runs").select("id,recipe,status,result,error_category,created_at,finished_at,lease_expires_at").eq("user_id", user.id).lte("created_at", exportedAt).order("created_at").order("id").range(from, to)),
        collectExportPages((from, to) => db.from("usage_buckets").select("kind,day,used").eq("scope", user.id).order("day").order("kind").range(from, to)),
        collectExportPages((from, to) => db.from("subscriptions").select("customer_id,subscription_id,status,live_mode,updated_at").eq("user_id", user.id).order("user_id").range(from, to)),
        collectExportPages((from, to) => db.from("billing_accounts").select("live_mode,customer_id,created_at").eq("user_id", user.id).order("live_mode").range(from, to)),
        collectExportPages((from, to) => db.from("billing_customers").select("live_mode,customer_id,created_at").eq("user_id", user.id).order("live_mode").order("customer_id").range(from, to)),
        collectExportPages((from, to) => db.from("billing_checkout_attempts").select("id,live_mode,customer_id,session_id,status,expires_at,created_at").eq("user_id", user.id).lte("created_at", exportedAt).order("created_at").order("id").range(from, to)),
      ]);
      const archive = encodeAccountExport({
        format: "opsstudio-account-export-v1", exportedAt,
        account: publicAccountIdentity(user), progress, answers, labs, usage,
        billing: { subscription, accounts, customers, checkouts },
        notes: ["This export contains records stored by OpsStudio when each collection was read. Concurrent edits may finish after the export starts.", "Device-only work must also be exported from the engineering notebook on that device.", "Payment-provider financial records and provider backups are managed separately by their providers."],
      });
      return new Response(archive, { headers: { "Cache-Control": "no-store", "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="opsstudio-account-data.json.gz"' } });
    }
    const day = new Date().toISOString().slice(0, 10);
    const [usage, subscription] = await Promise.all([
      db.from("usage_buckets").select("kind,used").eq("scope", user.id).eq("day", day),
      db.from("subscriptions").select("status,live_mode").eq("user_id", user.id).maybeSingle(),
    ]);
    if (usage.error || subscription.error) return errorResponse("Account details are temporarily unavailable.", 503);
    return Response.json({ userId: user.id, usage: usage.data, limits: { mentor: integerEnv("AI_USER_DAILY_LIMIT", 8), lab: integerEnv("LAB_USER_DAILY_LIMIT", 2) }, subscription: subscription.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return accountError(error); }
}

export async function DELETE(request: Request) {
  let input;
  try { input = await readBody(request, accountDeletionSchema, 8192); }
  catch { return errorResponse("Confirm DELETE, your current password, and the current account using a same-origin JSON request.", 400); }
  let release: (() => Promise<void>) | undefined;
  try {
    const user = await currentUser();
    if (!user) return errorResponse("Sign in again before deleting your account.", 401);
    if (!user.email) return errorResponse("This account needs an operator-assisted identity check before deletion.", 409);
    const admin = adminSupabase();
    const result = await eraseAccount(user.id, input, {
      verifyPassword: async password => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new AccountActionError("Account verification is unavailable.", 503, "VERIFICATION_UNAVAILABLE");
        // This isolated, non-persistent client cannot replace the request's cookies
        // or browser session with its short-lived password verification session.
        const verifier = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: (target, init) => fetch(target, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) }) },
        });
        const { data, error } = await verifier.auth.signInWithPassword({ email: user.email!, password });
        if (error || !data.user || !data.session) throw new AccountActionError("The password could not be verified. Check it and try again.", 403, "REAUTHENTICATION_FAILED");
        return { userId: data.user.id, accessToken: data.session.access_token };
      },
      prepareBilling: async cancelSubscriptions => {
        const prepared = await prepareAccountBillingErasure(user.id, { cancelSubscriptions });
        release = prepared.release;
      },
      revokeSessions: async accessToken => {
        const { error } = await admin.auth.admin.signOut(accessToken, "global");
        if (error) throw new AccountActionError("Account sessions could not be revoked. Deletion has not finished; please try again.", 503, "SESSION_REVOCATION_FAILED");
      },
      deleteUser: async () => {
        const { error } = await admin.auth.admin.deleteUser(user.id);
        if (error) throw new AccountActionError("Your sessions were revoked, but account deletion did not finish. Sign in again and retry. Billing cancellations already confirmed remain in effect.", 503, "DELETION_INCOMPLETE");
      },
      closeVerificationSession: async accessToken => {
        const { error } = await admin.auth.admin.signOut(accessToken, "local");
        if (error) throw error;
      },
    });
    // Failure to clear a stale browser cookie must not turn a completed deletion
    // into a misleading failure. The client clears its captured principal too.
    try { await (await serverSupabase()).auth.signOut({ scope: "local" }); } catch { /* The removed account cannot authenticate. */ }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return accountError(error); }
  finally { await release?.().catch(() => {}); } // Cascading user deletion also removes the lease row.
}

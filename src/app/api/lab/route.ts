import { randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { adminSupabase, currentUser } from "@/lib/supabase/server";
import { readBody, errorResponse, integerEnv } from "@/lib/http";
import { labRecipe, recipeIds } from "@/lib/lab-recipes";

export const maxDuration = 60;
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return errorResponse("Sign in to run a real verification lab.", 401);
  if (process.env.LABS_ENABLED === "false")
    return errorResponse(
      "Real labs are paused. The simulation remains available.",
      503,
    );
  let body;
  try {
    body = await readBody(
      request,
      z.object({ recipe: z.enum(recipeIds) }),
      2048,
    );
  } catch {
    return errorResponse("Choose a supported verification recipe.");
  }
  const db = adminSupabase();
  const id = randomUUID();
  const { data: quota, error } = await db.rpc("claim_lab_run", {
    p_user: user.id,
    p_id: id,
    p_recipe: body.recipe,
    p_user_limit: integerEnv("LAB_USER_DAILY_LIMIT", 2),
    p_global_limit: integerEnv("LAB_GLOBAL_DAILY_LIMIT", 10),
  });
  if (error || !quota)
    return errorResponse("The usage check is unavailable. No lab was started.", 503);
  if (quota.status === "quota")
    return errorResponse("Today's real-lab allowance is used. It resets at midnight UTC.", 429);
  if (quota.status !== "claimed" || quota.id !== id)
    return errorResponse("The lab could not be reserved safely. No lab was started.", 503);
  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create({
      runtime: "node24",
      timeout: 45000,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
    });
    await sandbox.writeFiles([
      {
        path: "/vercel/sandbox/verify.mjs",
        content: Buffer.from(labRecipe(body.recipe)),
      },
    ]);
    const command = await sandbox.runCommand("node", [
      "/vercel/sandbox/verify.mjs",
    ]);
    const stdout = (await command.stdout()).trim();
    if (command.exitCode !== 0) throw new Error("Verification failed");
    const result = JSON.parse(stdout);
    const { data: persisted, error: persistError } = await db
      .from("lab_runs")
      .update({ status: "complete", result, finished_at: new Date().toISOString() })
      .eq("id", id).eq("status", "pending").gt("lease_expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (persistError || !persisted) throw new Error("Could not save verification evidence");
    return Response.json({
      id,
      ...result,
      mode: "real-execution",
      remaining: quota.remaining,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await db
      .from("lab_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_category: "execution_failed",
        result: {
          message:
            "The isolated execution could not finish. No successful verification is claimed.",
        },
      })
      .eq("id", id).neq("status", "complete");
    return errorResponse(
      "The isolated lab could not finish. No successful result is claimed. Your simulation is unchanged.",
      502,
    );
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}

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
  const { data: quota, error } = await db.rpc("reserve_usage", {
    p_user: user.id,
    p_kind: "lab",
    p_user_limit: integerEnv("LAB_USER_DAILY_LIMIT", 2),
    p_global_limit: integerEnv("LAB_GLOBAL_DAILY_LIMIT", 10),
  });
  if (error)
    return errorResponse(
      "The usage check is unavailable. No lab was started.",
      503,
    );
  if (!quota?.allowed)
    return errorResponse(
      "Today's real-lab allowance is used. It resets at midnight UTC.",
      429,
    );
  const { error: saveError } = await db
    .from("lab_runs")
    .insert({ id, user_id: user.id, recipe: body.recipe, status: "pending" });
  if (saveError)
    return errorResponse(
      "The lab result could not be reserved. No lab was started.",
      503,
    );
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
    const { error: persistError } = await db
      .from("lab_runs")
      .update({ status: "complete", result })
      .eq("id", id);
    if (persistError) throw new Error("Could not save verification evidence");
    return Response.json({
      id,
      ...result,
      mode: "real-execution",
      remaining: quota.remaining,
    });
  } catch {
    await db
      .from("lab_runs")
      .update({
        status: "error",
        result: {
          message:
            "The isolated execution could not finish. No successful verification is claimed.",
        },
      })
      .eq("id", id);
    return errorResponse(
      "The isolated lab could not finish. No successful result is claimed. Your simulation is unchanged.",
      502,
    );
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}

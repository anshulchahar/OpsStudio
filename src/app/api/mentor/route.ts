import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { adminSupabase, currentUser } from "@/lib/supabase/server";
import { readBody, errorResponse, integerEnv } from "@/lib/http";
import { actionIds } from "@/lib/engine";
import {
  mentorRequestSchema,
  resolveMentorContext,
} from "@/lib/mentor-context";

export const maxDuration = 30;
const answerSchema = z.object({
  answer: z.string().min(1).max(5000),
  hint: z.string().max(800),
  action: z.enum(actionIds).nullable(),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return errorResponse(
      "Sign in for the Gemini mentor. Guided hints are available without an account.",
      401,
    );
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_API;
  if (process.env.AI_ENABLED === "false" || !key)
    return errorResponse(
      "The Gemini mentor is paused. You can still use the guided hints.",
      503,
    );
  let body;
  let context;
  try {
    body = await readBody(request, mentorRequestSchema, 40000);
    context = resolveMentorContext(body);
  } catch {
    return errorResponse(
      "Choose an available project request or mission and ask a question of up to 1,200 characters.",
    );
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ v: 2, model, context }))
    .digest("hex");
  const db = adminSupabase();
  const { data: cached } = await db
    .from("ai_generations")
    .select("id,answer")
    .eq("user_id", user.id)
    .eq("cache_key", cacheKey)
    .eq("status", "complete")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached)
    return Response.json({ ...cached.answer, id: cached.id, cached: true });
  const { data: quota, error: quotaError } = await db.rpc("reserve_usage", {
    p_user: user.id,
    p_kind: "mentor",
    p_user_limit: integerEnv("AI_USER_DAILY_LIMIT", 8),
    p_global_limit: integerEnv("AI_GLOBAL_DAILY_LIMIT", 100),
  });
  if (quotaError)
    return errorResponse(
      "The usage check is unavailable. No Gemini request was sent.",
      503,
    );
  if (!quota?.allowed)
    return errorResponse(
      "Today's mentor allowance has been reached. It resets at midnight UTC; guided hints remain available.",
      429,
    );
  const id = randomUUID();
  const { error: saveError } = await db.from("ai_generations").insert({
    id,
    user_id: user.id,
    cache_key: cacheKey,
    mission_id: context.recordId,
    model,
    prompt: body.question,
    status: "pending",
  });
  if (saveError)
    return errorResponse(
      "The answer could not be reserved safely. No Gemini request was sent.",
      503,
    );
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: context.systemInstruction,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify(context.payload),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                answer: { type: "string" },
                hint: { type: "string" },
                action:
                  context.mode === "project"
                    ? { type: "null" }
                    : { type: ["string", "null"] },
              },
              required: ["answer", "hint", "action"],
            },
            ...(model.includes("2.5-flash-lite")
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : { thinkingConfig: { thinkingLevel: "minimal" } }),
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(
        (p: { text?: string; thought?: boolean }) => p.text && !p.thought,
      )
      .map((p: { text: string }) => p.text)
      .join("");
    const answer = answerSchema.parse(JSON.parse(text || "{}"));
    if (answer.action !== context.allowedAction) answer.action = null;
    const input = data.usageMetadata?.promptTokenCount || 0;
    const output =
      (data.usageMetadata?.candidatesTokenCount || 0) +
      (data.usageMetadata?.thoughtsTokenCount || 0);
    const { error } = await db
      .from("ai_generations")
      .update({
        answer,
        status: "complete",
        input_tokens: input,
        output_tokens: output,
        estimated_usd:
          model === "gemini-3.1-flash-lite"
            ? (input * 0.25 + output * 1.5) / 1000000
            : model === "gemini-2.5-flash-lite"
              ? (input * 0.1 + output * 0.4) / 1000000
              : 0,
      })
      .eq("id", id);
    if (error) throw new Error("Persistence unavailable");
    return Response.json({
      ...answer,
      id,
      cached: false,
      remaining: quota.remaining,
    });
  } catch (error) {
    const category =
      error instanceof Error && /^provider_http_[0-9]{3}$/.test(error.message)
        ? error.message
        : error instanceof Error
          ? error.name
          : "UnknownError";
    console.error("mentor_generation_failed", { id, category });
    await db.from("ai_generations").update({ status: "error" }).eq("id", id);
    return errorResponse(
      "Gemini could not finish this answer. No automatic retry was made. Use a guided hint or try again later.",
      502,
    );
  }
}

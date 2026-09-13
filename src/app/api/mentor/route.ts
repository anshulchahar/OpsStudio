import { createHash, randomUUID } from "node:crypto";
import { adminSupabase, currentUser } from "@/lib/supabase/server";
import { readBody, errorResponse, integerEnv } from "@/lib/http";
import { geminiUsage, parseGeminiAnswer } from "@/lib/gemini-result";
import {
  mentorRequestSchema,
  resolveMentorContext,
} from "@/lib/mentor-context";

export const maxDuration = 30;

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
    body = await readBody(request, mentorRequestSchema, 131072);
    context = resolveMentorContext(body);
    if (Buffer.byteLength(JSON.stringify(context)) > 32768)
      throw new Error("Mentor context exceeds the bounded generation budget.");
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
  const proposedId = randomUUID();
  const { data: claim, error: claimError } = await db.rpc("claim_mentor_generation", {
    p_user: user.id,
    p_cache: cacheKey,
    p_id: proposedId,
    p_mission: context.recordId,
    p_model: model,
    p_prompt: body.question,
    p_user_limit: integerEnv("AI_USER_DAILY_LIMIT", 8),
    p_global_limit: integerEnv("AI_GLOBAL_DAILY_LIMIT", 100),
  });
  if (claimError || !claim)
    return errorResponse("The answer could not be reserved safely. No Gemini request was sent.", 503);
  if (claim.status === "cached")
    return Response.json({ ...claim.answer, id: claim.id, cached: true }, { headers: { "Cache-Control": "no-store" } });
  if (claim.status === "pending")
    return Response.json({ error: "This question is already being prepared. Check the saved answer shortly; no second Gemini request was sent.", id: claim.id, pending: true }, { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "5" } });
  if (claim.status === "quota")
    return errorResponse("Today's mentor allowance has been reached. It resets at midnight UTC; guided hints remain available.", 429);
  if (claim.status !== "claimed" || claim.id !== proposedId)
    return errorResponse("The answer reservation could not be verified. No Gemini request was sent.", 503);
  const id = claim.id;
  let usage = geminiUsage(null, model);
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
                action: { type: ["string", "null"] },
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
    const data = await response.json();
    // Record provider-reported usage before parsing generated content: malformed
    // JSON, blocked candidates and schema failures can still consume tokens.
    usage = geminiUsage(data, model);
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const answer = parseGeminiAnswer(data, context.allowedAction);
    const { data: saved, error } = await db
      .from("ai_generations")
      .update({ answer, status: "complete", ...usage, finished_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("status", "pending")
      .gt("lease_expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (error || !saved) throw new Error("Persistence unavailable");
    return Response.json({ ...answer, id, cached: false, remaining: claim.remaining }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const category =
      error instanceof Error && /^provider_http_[0-9]{3}$/.test(error.message)
        ? error.message
        : error instanceof Error
          ? error.name
          : "UnknownError";
    console.error("mentor_generation_failed", { id, category });
    const { error: saveError } = await db.from("ai_generations")
      .update({ status: "error", ...usage, error_category: category, finished_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).neq("status", "complete");
    if (saveError) console.error("mentor_usage_persistence_failed", { id, category, ...usage });
    return errorResponse(
      "Gemini could not finish this answer. No automatic retry was made. Use a guided hint or try again later.",
      502,
    );
  }
}

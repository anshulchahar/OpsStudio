import { z } from "zod";
import { actionIds } from "./engine.ts";
const answerSchema = z.object({
  answer: z.string().min(1).max(5000),
  hint: z.string().max(800),
  action: z.enum(actionIds).nullable(),
});
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const tokens = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10000000 ? value : null;

export type GeminiUsage = {
  input_tokens: number;
  output_tokens: number;
  usage_known: boolean;
  estimated_usd: number | null;
  finish_reason: string | null;
};
export function geminiUsage(data: unknown, model: string): GeminiUsage {
  const response = object(data);
  const metadata = object(response.usageMetadata);
  const input = tokens(metadata.promptTokenCount);
  const candidates = tokens(metadata.candidatesTokenCount);
  const thoughts = tokens(metadata.thoughtsTokenCount);
  const total = tokens(metadata.totalTokenCount);
  const output = candidates !== null ? candidates + (thoughts || 0)
    : input !== null && total !== null && total >= input ? total - input
      : null;
  const usageKnown = input !== null && output !== null;
  const rates = model === "gemini-3.1-flash-lite" ? [0.25, 1.5] : model === "gemini-2.5-flash-lite" ? [0.1, 0.4] : null;
  const first = Array.isArray(response.candidates) ? object(response.candidates[0]) : {};
  return {
    input_tokens: input || 0,
    output_tokens: output || 0,
    usage_known: usageKnown,
    estimated_usd: usageKnown && rates ? Math.round(((input * rates[0] + output * rates[1]) / 1000000) * 1e8) / 1e8 : null,
    finish_reason: typeof first.finishReason === "string" ? first.finishReason.slice(0, 80) : null,
  };
}

export function parseGeminiAnswer(data: unknown, allowedAction: string | null) {
  const response = object(data);
  const candidate = Array.isArray(response.candidates) ? object(response.candidates[0]) : {};
  const content = object(candidate.content);
  const text = Array.isArray(content.parts) ? content.parts.map(object)
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text).join("") : "";
  const answer = answerSchema.parse(JSON.parse(text || "{}"));
  if (answer.action !== allowedAction) answer.action = null;
  return answer;
}

import { z } from "zod";

export function appOrigin() {
  if (process.env.APP_URL) return new URL(process.env.APP_URL).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 65536,
): Promise<T> {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== appOrigin()
  )
    throw new Error("This request origin is not permitted.");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Send a JSON request.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new Error("The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("The request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("The request is too large.");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  const result = schema.safeParse(JSON.parse(new TextDecoder().decode(buffer)));
  if (!result.success)
    throw new Error("The request contains invalid or incomplete information.");
  return result.data;
}
export function errorResponse(message: string, status = 400) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function integerEnv(name: string, fallback: number, max = 1000) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : fallback;
}

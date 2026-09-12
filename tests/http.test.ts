import { it } from "node:test";
import { expect } from "./assert.ts";
import { z } from "zod";
import { readBody } from "../src/lib/http.ts";
const schema = z.object({ message: z.string() });
const request = (body: string, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body,
  });
it("validates both request origin and JSON shape", async () => {
  expect(await readBody(request('{"message":"hi"}'), schema)).toEqual({
    message: "hi",
  });
  await expect(
    readBody(request('{"message":"hi"}', "https://untrusted.example"), schema),
  ).rejects.toThrow("origin");
  await expect(readBody(request('{"message":42}'), schema)).rejects.toThrow(
    "invalid",
  );
});
it("bounds actual streamed bytes without trusting content-length", async () => {
  await expect(
    readBody(
      request(JSON.stringify({ message: "x".repeat(200) })),
      schema,
      100,
    ),
  ).rejects.toThrow("too large");
});

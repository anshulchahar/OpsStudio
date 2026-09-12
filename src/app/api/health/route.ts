export function GET() {
  return Response.json(
    { status: "ok", service: "OpsStudio", version: "0.1.0" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

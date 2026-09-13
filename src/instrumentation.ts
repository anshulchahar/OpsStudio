import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  // Request paths, query strings, exception messages and cookies can contain private data.
  // Keep only the framework's static route template and an allowlisted category.
  console.error(JSON.stringify({ service: "OpsStudio", code: "UNHANDLED_REQUEST_ERROR", route: context.routePath, type: context.routeType }));
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordOperation } = await import("./lib/operations");
    await recordOperation("server-errors", "error", "UNHANDLED_REQUEST_ERROR");
  }
};

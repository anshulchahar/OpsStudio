// No messages, stack traces, user IDs, URLs, notes or prompts leave the browser.
let reported = 0;
function report(kind: "runtime" | "promise") {
  if (reported >= 3) return;
  reported += 1;
  void fetch("/api/telemetry", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }), keepalive: true,
  }).catch(() => { /* Monitoring cannot break the workspace. */ });
}
window.addEventListener("error", () => report("runtime"));
window.addEventListener("unhandledrejection", () => report("promise"));

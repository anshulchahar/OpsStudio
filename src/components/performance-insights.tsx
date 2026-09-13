"use client";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function PerformanceInsights({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <SpeedInsights sampleRate={0.1} debug={false} beforeSend={event => {
    const url = new URL(event.url);
    if (url.pathname.startsWith("/answers/") || url.pathname.startsWith("/auth/") || url.pathname === "/settings") return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.href };
  }} />;
}

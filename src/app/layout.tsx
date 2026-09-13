import type { Metadata } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import "./workbench.css";
import "./mission-flow.css";
import "./journey-flow.css";
import "./portfolio.css";
import "./record-portfolio.css";
import { AppProvider } from "@/components/app-provider";
import { PerformanceInsights } from "@/components/performance-insights";
export const metadata: Metadata = {
  title: {
    default: "OpsStudio — Your engineering workspace",
    template: "%s · OpsStudio",
  },
  description:
    "Practice DevSecOps across different industries. Join fictional engineering teams, rehearse changes, inspect consequences, and build a record of decisions with an AI teammate.",
  applicationName: "OpsStudio",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppProvider>{children}</AppProvider>
        <PerformanceInsights enabled={process.env.VERCEL_ENV === "production"} />
      </body>
    </html>
  );
}

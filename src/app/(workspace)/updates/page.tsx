import {
  ArrowUpRight,
  RefreshCw,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { adminSupabase } from "@/lib/supabase/server";
import { releaseSources } from "@/lib/release-catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Release radar · OpsStudio" };
export default async function Updates() {
  const { data } = await adminSupabase()
    .from("release_catalog")
    .select("id,version,checked_at,recommendation,candidate_title");
  return (
    <div className="page updates-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <RefreshCw size={13} />
            THE RELEASE RADAR
          </div>
          <h1>
            KEEP THE STACK <span>CURRENT.</span>
          </h1>
          <p>
            Daily checks from official sources, with a reason to investigate
            before you upgrade.
          </p>
        </div>
      </div>
      <div className="journey-banner">
        <ShieldCheck size={25} />
        <div>
          <strong>Version numbers are a starting point.</strong>
          <p>
            Compatibility, support, and evidence decide an upgrade. These
            recommendations do not claim a vulnerability scan or a tested
            migration.
          </p>
        </div>
      </div>
      <div className="release-grid">
        {releaseSources.map((source) => {
          const record = data?.find((r) => r.id === source.id);
          return (
            <section className="release-card" key={source.id}>
              <div className="eyebrow">
                {source.id === "node"
                  ? "RECIPE RUNTIME · LTS 24"
                  : "ADVANCED LEARNING REFERENCE"}
              </div>
              <h2>
                {source.name}
                <span>{record?.version || "Awaiting first check"}</span>
              </h2>
              <p className="release-checked">
                {record
                  ? `Checked ${new Date(record.checked_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
                  : "The previous source could not be confirmed. No version is guessed."}
              </p>
              <p>{record?.recommendation || source.recommendation}</p>
              <a
                className="text-link"
                href={source.reference}
                target="_blank"
                rel="noreferrer"
              >
                Official release guidance
                <ArrowUpRight size={14} />
              </a>
              <div className="release-candidate">
                <FlaskConical size={17} />
                <div>
                  <small>PROPOSED FUTURE EXERCISE</small>
                  <strong>{record?.candidate_title || source.candidate}</strong>
                  <p>
                    A curriculum candidate for review. This exercise is not yet
                    runnable.
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <p className="journey-note">
        The daily refresh uses no Gemini requests and keeps existing missions
        stable. New projects and fully automated infrastructure upgrades remain
        on the product roadmap.
      </p>
    </div>
  );
}

"use client";
import Link from "next/link";
import {
  Download,
  NotebookPen,
  Check,
  ArrowRight,
  FileText,
  History,
  GitBranch,
  FlaskConical,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { missions } from "@/lib/curriculum";
import { projects } from "@/lib/projects";
import {
  deriveProject,
  emptyProjectRun,
  renderProjectReport,
} from "@/lib/project-engine";

function downloadRecord(report: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([report], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Notebook() {
  const { progress, update, sync, ready } = useStudio();
  const records = projects
    .map((project) => {
      const run = progress.portfolio.runs[project.id] ?? emptyProjectRun();
      const derived = deriveProject(project, run);
      const practiced = Object.values(derived.accepted).map((selection) => selection.work);
      return {
        project,
        run,
        derived,
        skills: [...new Set(practiced.flatMap((work) => work.skills))],
      };
    })
    .filter(
      ({ run }) =>
        run.history.length > 0 || Object.keys(run.selections).length > 0,
    );
  const shipped = records.reduce(
    (total, record) => total + record.derived.shippedIds.length,
    0,
  );
  const legacyWork = missions.filter((mission) =>
    progress.completed.includes(mission.id),
  );

  function exportNotebook() {
    const legacy =
      legacyWork.length || progress.checkpoints.length
        ? `\n\n# Earlier Northstar record\n\n${legacyWork.map((mission) => `- ${mission.title}: ${mission.decision.explanation}`).join("\n") || "No completed work recorded."}\n\nSaved checkpoints: ${progress.checkpoints.length}\n\n## Preserved system and checkpoints\n\n\`\`\`json\n${JSON.stringify({ currentState: progress.state, checkpoints: progress.checkpoints }, null, 2)}\n\`\`\``
        : "";
    const report = `# My OpsStudio engineering record\n\nExported: ${new Date().toISOString()}\n\n## My notes\n\n${progress.notes || "No notes yet."}\n\n${records.map(({ project, run }) => renderProjectReport(project, run)).join("\n---\n\n") || "No project changes recorded yet."}${legacy}\n\nThis portfolio documents practice in modeled systems. It is not a professional certification or proof of production work.\n`;
    downloadRecord(report, "my-opsstudio-engineering-record.md");
  }

  return (
    <div className="page notebook-page record-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR ENGINEERING RECORD</div>
          <h1>
            THE WORK <span>YOU CAN EXPLAIN.</span>
          </h1>
          <p>
            The approaches you tried, what they changed, and the tradeoffs you
            would carry into your next project.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={exportNotebook}
          disabled={!ready}
        >
          <Download size={16} /> Export record
        </button>
      </div>
      <div
        className="record-overview"
        aria-label="Your project record at a glance"
      >
        <span>
          <strong>{records.length}</strong> projects explored
        </span>
        <span>
          <strong>{shipped}</strong> changes shipped in rehearsal
        </span>
        <span>
          <strong>
            {records.reduce(
              (total, record) => total + record.run.history.length,
              0,
            )}
          </strong>{" "}
          retained change receipts
        </span>
      </div>
      <div className="record-columns">
        <section className="project-records" aria-label="Project records">
          {records.length === 0 ? (
            <div className="record-empty">
              <FileText size={30} />
              <h2>Your first decision belongs here.</h2>
              <p>
                Pick a project, take on a request, and rehearse a change. Its
                evidence and the decision behind it will appear automatically.
              </p>
              <Link href="/" className="button primary">
                Choose a project <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            records.map(({ project, run, derived, skills }) => (
              <article className="project-record" key={project.id}>
                <header>
                  <div>
                    <span className="record-industry">{project.industry}</span>
                    <h2>{project.name}</h2>
                    <p>
                      {derived.shippedIds.length} changes shipped ·{" "}
                      {run.history.length} retained receipts
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Export ${project.name} record`}
                    onClick={() =>
                      downloadRecord(
                        renderProjectReport(project, run),
                        `opsstudio-${project.id}-record.md`,
                      )
                    }
                  >
                    <Download size={18} />
                  </button>
                </header>
                <div
                  className="record-metrics"
                  aria-label={`${project.name} modeled measurements`}
                >
                  <span>
                    <small>Availability</small>
                    <strong>{derived.metrics.availability}%</strong>
                  </span>
                  <span>
                    <small>Risk</small>
                    <strong>
                      {derived.metrics.risk}
                      <em> / 100</em>
                    </strong>
                  </span>
                  <span>
                    <small>Latency</small>
                    <strong>
                      {derived.metrics.latency}
                      <em> ms</em>
                    </strong>
                  </span>
                  <span>
                    <small>Monthly cost</small>
                    <strong>€{derived.metrics.monthlyCost}</strong>
                  </span>
                </div>
                <div className="record-skills">
                  <span>Practiced through this work</span>
                  <div>
                    {skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>
                {derived.latest ? (
                  <div className="record-decision">
                    <GitBranch size={17} />
                    <div>
                      <strong>{derived.latest.work.title}</strong>
                      <p>{derived.latest.option.learning}</p>
                      <span>
                        Next improvement: {derived.latest.option.recommendation}
                      </span>
                    </div>
                  </div>
                ) : null}
                <details className="record-receipts">
                  <summary>
                    <History size={15} /> Recent change receipts
                  </summary>
                  <ol>
                    {run.history
                      .slice(-5)
                      .reverse()
                      .map((receipt) => {
                        const currentWork = project.work.find(
                          (item) => item.id === receipt.workId,
                        );
                        const work = receipt.snapshot?.work ?? currentWork;
                        const option = receipt.snapshot?.option ?? currentWork?.options.find(
                          (item) => item.id === receipt.optionId,
                        );
                        if (!work || !option) return null;
                        return (
                          <li key={receipt.id}>
                            <span
                              role="img"
                              className={`receipt-state ${option.outcome === "needs-work" ? "needs-work" : ""}`}
                              aria-label={
                                option.outcome === "shipped"
                                  ? "Accepted in rehearsal"
                                  : "Needs more work"
                              }
                            />
                            <div>
                              <strong>{work.title}</strong>
                              <p>{option.title}</p>
                              <small>{option.tradeoff}</small>
                            </div>
                            <time dateTime={receipt.at}>
                              {new Date(receipt.at).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </time>
                          </li>
                        );
                      })}
                  </ol>
                  <p>
                    The record keeps your latest 40 receipts per project.
                    Exports include all retained receipts.
                  </p>
                </details>
                <footer>
                  <span>Measurements describe the practice model.</span>
                  <Link href={`/projects/${project.id}`}>
                    Return to the project <ArrowRight size={14} />
                  </Link>
                </footer>
              </article>
            ))
          )}
          {legacyWork.length || progress.checkpoints.length ? (
            <details className="legacy-record">
              <summary>
                <History size={16} />
                <span>Earlier Northstar work</span>
                <small>{legacyWork.length} completed decisions</small>
              </summary>
              <p>
                Your earlier work and {progress.checkpoints.length} saved
                checkpoints are preserved. Your notes stay in the shared record.
              </p>
              {legacyWork.map((mission) => (
                <div className="learned-item" key={mission.id}>
                  <Check size={14} />
                  <span>{mission.title}</span>
                </div>
              ))}
            </details>
          ) : null}
        </section>
        <aside className="record-notes">
          <section className="notes-editor">
            <header>
              <div>
                <NotebookPen size={19} />
                <h2>Notes from the work</h2>
              </div>
              <span>{sync}</span>
            </header>
            <textarea
              aria-label="Your engineering notes"
              value={progress.notes}
              disabled={!ready}
              maxLength={20000}
              onChange={(event) =>
                update((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              placeholder={
                "A decision worth keeping…\n\n“I chose ___ because ___. The tradeoff was ___. Next I would verify ___.”\n\nOr leave a question for your future self."
              }
            />
            <footer>
              <span>Saved automatically.</span>
              <span>{progress.notes.length.toLocaleString()} / 20,000</span>
            </footer>
          </section>
          <p className="record-note-caption">
            The useful part is being able to explain why. Your notes and exports
            stay yours.
          </p>
          <Link href="/labs" className="record-verification-link">
            <FlaskConical size={16} />
            <span>Open verification bench</span>
            <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

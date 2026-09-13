"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Download,
  FileCheck2,
  Inbox,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { Dialog } from "./dialog";
import { ProjectCanvas } from "./project-canvas";
import { findProject, projects } from "@/lib/projects";
import {
  deriveProject,
  emptyProjectRun,
  runProjectChange,
  renderProjectReport,
} from "@/lib/project-engine";
import type {
  Approach,
  PracticeProject,
  Metrics,
  WorkOrder,
} from "@/lib/project-types";

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectWorkspace({ projectId }: { projectId?: string }) {
  const { progress } = useStudio();
  const project =
    findProject(projectId || progress.portfolio.activeProject) || projects[0];
  return <ProjectDesk key={project.id} project={project} />;
}
function ProjectDesk({ project }: { project: PracticeProject }) {
  const { progress, update, ready, sync } = useStudio();
  const run = progress.portfolio.runs[project.id] || emptyProjectRun();
  const state = deriveProject(project, run);
  const work =
    project.work.find((item) => item.id === run.activeWorkId) ||
    state.availableWork.find((item) => !state.shippedIds.includes(item.id)) ||
    project.work[0];
  const [inbox, setInbox] = useState(false);
  const [busy, setBusy] = useState(false);
  function selectWork(id: string) {
    if (!ready || busy) return;
    update((p) => ({
      ...p,
      portfolio: {
        ...p.portfolio,
        activeProject: project.id,
        runs: {
          ...p.portfolio.runs,
          [project.id]: {
            ...(p.portfolio.runs[project.id] || emptyProjectRun()),
            activeWorkId: id,
          },
        },
      },
    }));
    setInbox(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <div
      className="page project-desk-page"
      style={{ "--project-accent": project.accent } as React.CSSProperties}
    >
      <div className="project-desk-top">
        <Link href="/" className="text-link">
          <ArrowLeft size={14} />
          Project shelf
        </Link>
        <span>{sync}</span>
      </div>
      <header className="project-desk-heading">
        <span className="company-monogram">
          {project.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <div className="eyebrow">
            {project.industry} / {project.stage}
          </div>
          <h1>
            {project.name}
            <span> / workspace</span>
          </h1>
        </div>
        <button
          className="button secondary"
          onClick={() => setInbox(true)}
          disabled={busy || !ready}
        >
          <Inbox size={16} />
          Team inbox
          <span>
            {
              state.availableWork.filter(
                (item) => !state.shippedIds.includes(item.id),
              ).length
            }
          </span>
          <ChevronDown size={14} />
        </button>
      </header>
      {ready ? (
        <WorkPanel
          key={work.id}
          project={project}
          work={work}
          onSelect={selectWork}
          onBusy={setBusy}
          onInbox={() => setInbox(true)}
        />
      ) : (
        <div className="project-restoring" role="status">
          <LoaderCircle size={20} className="spin" />
          Restoring your workspace…
        </div>
      )}
      <details className="project-record">
        <summary>
          <FileCheck2 size={16} />
          <strong>Engineering record</strong>
          <span>
            {state.shippedIds.length} changes shipped · {run.history.length}{" "}
            recent receipts
          </span>
          <ChevronDown size={15} />
        </summary>
        <div>
          <p>
            Your choices and their evidence are saved with this company. Revisit
            a request to compare another approach.
          </p>
          <button
            className="button secondary small"
            onClick={() =>
              download(
                `${project.id}-engineering-record.md`,
                renderProjectReport(project, run),
              )
            }
          >
            <Download size={14} />
            Export this project
          </button>
          {run.history
            .slice()
            .reverse()
            .slice(0, 12)
            .map((receipt) => {
              const currentItem = project.work.find(
                  (job) => job.id === receipt.workId,
                ),
                item = receipt.snapshot?.work ?? currentItem,
                option = receipt.snapshot?.option ?? currentItem?.options.find(
                  (choice) => choice.id === receipt.optionId,
                );
              return item && option ? (
                <button
                  key={receipt.id}
                  className="project-history-row"
                  disabled={busy || !currentItem}
                  onClick={() => selectWork(item.id)}
                >
                  <span className={`request-kind ${item.kind}`}>
                    {item.kind}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{option.title}</span>
                  </div>
                  <time>
                    {new Date(receipt.at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                  <ArrowUpRight size={14} />
                </button>
              ) : null;
            })}
          {!run.history.length && (
            <p className="muted">
              Your first applied change will leave a receipt here.
            </p>
          )}
        </div>
      </details>
      <Dialog
        open={inbox}
        onClose={() => setInbox(false)}
        title={`${project.name} · Team inbox`}
        wide
      >
        <p className="dialog-intro">{project.brief}</p>
        <div className="project-inbox">
          {project.work.map((item) => {
            const available = state.availableWork.some(
                (job) => job.id === item.id,
              ),
              shipped = state.shippedIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => selectWork(item.id)}
                className={item.id === work.id ? "selected" : ""}
              >
                <span className={`request-kind ${item.kind}`}>{item.kind}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {shipped
                      ? "Shipped · revisit your decision"
                      : available
                        ? "Ready to pick up"
                        : `Needs: ${item.requires
                            .filter((id) => !state.shippedIds.includes(id))
                            .map(
                              (id) =>
                                project.work.find((job) => job.id === id)
                                  ?.title,
                            )
                            .join(" · ")}`}
                  </small>
                </div>
                {shipped ? <Check size={17} /> : <ArrowRight size={16} />}
              </button>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}

function WorkPanel({
  project,
  work,
  onSelect,
  onBusy,
  onInbox,
}: {
  project: PracticeProject;
  work: WorkOrder;
  onSelect: (id: string) => void;
  onBusy: (value: boolean) => void;
  onInbox: () => void;
}) {
  const { progress, update, ready, user, notify } = useStudio();
  const run = progress.portfolio.runs[project.id] || emptyProjectRun();
  const system = deriveProject(project, run);
  const available = system.availableWork.some((item) => item.id === work.id);
  const currentOption = system.accepted[work.id]?.option;
  const [phase, setPhase] = useState<"request" | "plan" | "receipt">(
    currentOption && available ? "receipt" : "request",
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [hints, setHints] = useState(0);
  const [error, setError] = useState("");
  const [lastMetrics, setLastMetrics] = useState<{
    before: Metrics;
    after: Metrics;
  } | null>(null);
  const [mentor, setMentor] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{
    id: string;
    answer: string;
    hint: string;
    remaining?: number;
  } | null>(null);
  const [mentorError, setMentorError] = useState("");
  const [pendingAnswerId, setPendingAnswerId] = useState<string | null>(null);
  const token = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const option = work.options.find((item) => item.id === chosen) || null;
  const next = system.availableWork.find(
    (item) => item.id !== work.id && !system.shippedIds.includes(item.id),
  );
  const resultOption = phase === "receipt" ? currentOption : null;
  const preview =
    option && available
      ? runProjectChange(project, run, work.id, option.id, {
          id: "preview-only",
          at: "2000-01-01T00:00:00.000Z",
        })
      : null;
  useEffect(
    () => () => {
      token.current++;
      onBusy(false);
    },
    [onBusy],
  );
  useEffect(() => {
    if (!ready) return;
    const node = panel.current;
    if (!node) return;
    node
      .querySelector<HTMLElement>("[data-work-heading]")
      ?.focus({ preventScroll: true });
    if (node.getBoundingClientRect().top < 60)
      node.scrollIntoView({ block: "start", behavior: "instant" });
  }, [phase, ready]);
  async function apply() {
    if (!ready || !option || busy || !available) return;
    const ticket = ++token.current;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const result = runProjectChange(project, run, work.id, option.id, {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      });
      for (let i = 0; i < option.changes.length; i++) {
        setStep(i);
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (ticket !== token.current) return;
      }
      update((p) => {
        const latest = p.portfolio.runs[project.id] || emptyProjectRun();
        const fresh = runProjectChange(project, latest, work.id, option.id, {
          id: result.run.history.at(-1)!.id,
          at: result.run.history.at(-1)!.at,
        });
        return {
          ...p,
          portfolio: {
            ...p.portfolio,
            activeProject: project.id,
            runs: { ...p.portfolio.runs, [project.id]: fresh.run },
          },
        };
      });
      setLastMetrics({ before: result.before, after: result.after });
      setPhase("receipt");
      notify(
        option.outcome === "shipped"
          ? "Change shipped. Evidence added to your record."
          : "The rehearsal found a problem. Review the evidence and revise your approach.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rehearsal could not run.");
    } finally {
      if (ticket === token.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (asking || !question.trim()) return;
    if (!user) {
      setMentorError(
        "Sign in to ask Gemini. The project’s practical hints are available without an account.",
      );
      return;
    }
    setAsking(true);
    setMentorError("");
    setPendingAnswerId(null);
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          workId: work.id,
          run: { ...run, history: [] },
          question,
          proposedOptionId: chosen || undefined,
        }),
      });
      const data = await response.json();
      if (data.pending && typeof data.id === "string" && /^[0-9a-f-]{36}$/i.test(data.id)) setPendingAnswerId(data.id);
      if (!response.ok) throw new Error(data.error || "Ada could not answer.");
      setAnswer(data);
      setQuestion("");
    } catch (e) {
      setMentorError(e instanceof Error ? e.message : "Ada could not answer.");
    } finally {
      setAsking(false);
    }
  }
  const showHint = () =>
    setHints((value) => Math.min(value + 1, work.hints.length));
  return (
    <>
      <div className="work-context-bar">
        <span className={`request-kind ${work.kind}`}>{work.kind}</span>
        <span>
          {work.from.name} · {work.from.role}
        </span>
        <span>
          {system.shippedIds.includes(work.id)
            ? "Change in place"
            : available
              ? "Ready to pick up"
              : "Related work needed"}
        </span>
      </div>
      <div className="work-desk-grid">
        <section
          className="work-action"
          ref={panel}
          aria-label="Current work request"
          aria-busy={busy}
        >
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {phase === "request" ? (
              <>
                <span className="eyebrow">FROM YOUR TEAM</span>
                <h2 data-work-heading tabIndex={-1}>
                  {work.title}
                </h2>
                <p className="team-message">“{work.brief}”</p>
                {!available ? (
                  <div className="work-blocked">
                    <strong>
                      This change needs a few foundations in place.
                    </strong>
                    <p>
                      The dependency belongs to the system. You can explore any
                      company whenever you like.
                    </p>
                    {work.requires
                      .filter((id) => !system.shippedIds.includes(id))
                      .map((id) => (
                        <button
                          className="button secondary small"
                          key={id}
                          onClick={() => onSelect(id)}
                        >
                          {project.work.find((item) => item.id === id)?.title}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                  </div>
                ) : (
                  <>
                    <div className="work-options-heading">
                      <strong>How do you want to handle it?</strong>
                      <span>Different approaches. Different consequences.</span>
                    </div>
                    <fieldset className="work-approaches">
                      <legend className="sr-only">
                        Choose an implementation approach
                      </legend>
                      {work.options.map((item) => (
                        <label
                          key={item.id}
                          className={chosen === item.id ? "selected" : ""}
                        >
                          <input
                            type="radio"
                            name={`approach-${work.id}`}
                            value={item.id}
                            checked={chosen === item.id}
                            onChange={() => setChosen(item.id)}
                            disabled={!ready}
                          />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.summary}</p>
                          </div>
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="button primary work-primary"
                      disabled={!option || !ready}
                      onClick={() => setPhase("plan")}
                    >
                      Preview this change
                      <ArrowRight size={16} />
                    </button>
                    <span className="work-assurance">
                      No code to type. You decide; the studio applies the
                      change.
                    </span>
                  </>
                )}
              </>
            ) : phase === "plan" && option ? (
              <>
                <span className="eyebrow">YOUR PROPOSED CHANGE</span>
                <h2 data-work-heading tabIndex={-1}>
                  {option.title}
                </h2>
                <p className="team-message">{option.summary}</p>
                <div className="work-tradeoff">
                  <span>THE TRADEOFF</span>
                  <p>{option.tradeoff}</p>
                </div>
                <ol className="change-plan">
                  {option.changes.map((change, index) => (
                    <li
                      key={change}
                      className={
                        busy && index === step
                          ? "running"
                          : busy && index < step
                            ? "done"
                            : ""
                      }
                    >
                      <span>
                        {busy && index < step ? (
                          <Check size={13} />
                        ) : busy && index === step ? (
                          <LoaderCircle size={13} className="spin" />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      {change}
                    </li>
                  ))}
                </ol>
                {busy ? (
                  <div className="rehearsal-running" role="status">
                    <LoaderCircle className="spin" size={17} />
                    <span>{option.changes[step]}</span>
                  </div>
                ) : (
                  <button
                    className="button primary work-primary"
                    disabled={!ready}
                    onClick={apply}
                  >
                    <Play size={15} />
                    Apply in practice environment
                    <ArrowRight size={16} />
                  </button>
                )}
                <span className="work-assurance">
                  The system view previews the modelled effect. No cloud
                  resources are billed.
                </span>
                <button
                  className="text-link work-back"
                  disabled={busy}
                  onClick={() => setPhase("request")}
                >
                  <ArrowLeft size={13} />
                  Choose another approach
                </button>
              </>
            ) : resultOption ? (
              <>
                <span className={`work-outcome ${resultOption.outcome}`}>
                  <span>
                    {resultOption.outcome === "shipped" ? (
                      <CheckCheck size={21} />
                    ) : (
                      <TriangleAlert size={21} />
                    )}
                  </span>
                  {resultOption.outcome === "shipped"
                    ? "CHANGE SHIPPED"
                    : "NEEDS ANOTHER PASS"}
                </span>
                <h2 data-work-heading tabIndex={-1}>
                  {resultOption.outcome === "shipped"
                    ? "Here’s what happened."
                    : "The rehearsal caught a problem."}
                </h2>
                <p className="work-receipt-choice">{resultOption.title}</p>
                <small>{run.applied[work.id] ? `Saved evidence · catalog ${run.applied[work.id].catalogVersion}` : "Earlier decision · evidence shown from the current catalog"}</small>
                <div className="work-evidence">
                  {resultOption.evidence.map((item, index) => (
                    <div key={index} className={item.status}>
                      <span>
                        {item.status === "pass" ? (
                          <Check size={14} />
                        ) : (
                          <TriangleAlert size={14} />
                        )}
                      </span>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="work-takeaway">
                  <span>THE ENGINEERING BEHIND IT</span>
                  <p>{resultOption.learning}</p>
                </div>
                <div className="work-recommendation">
                  <Lightbulb size={17} />
                  <div>
                    <strong>A useful next move</strong>
                    <p>{resultOption.recommendation}</p>
                  </div>
                </div>
                {resultOption.outcome === "needs-work" ? (
                  <button
                    className="button primary work-primary"
                    onClick={() => {
                      setPhase("request");
                      setChosen(null);
                    }}
                  >
                    Revise your approach
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="button primary work-primary"
                    onClick={() => (next ? onSelect(next.id) : onInbox())}
                  >
                    {next ? "Pick up another request" : "See your team inbox"}
                    <ArrowRight size={16} />
                  </button>
                )}
                {next && resultOption.outcome === "shipped" && (
                  <span className="work-next-name">{next.title}</span>
                )}
                <button
                  className="text-link work-back"
                  onClick={() => setPhase("request")}
                >
                  <RotateCcw size={13} />
                  Compare another approach
                </button>
              </>
            ) : (
              <button
                className="button primary"
                onClick={() => setPhase("request")}
              >
                Review this request
                <ArrowRight size={16} />
              </button>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="work-guidance">
              <button
                className="text-link"
                disabled={busy || hints >= work.hints.length}
                onClick={showHint}
              >
                <Lightbulb size={14} />
                {hints
                  ? `Another nudge · ${hints}/${work.hints.length}`
                  : "Give me a nudge"}
              </button>
              <button className="text-link" onClick={() => setMentor(true)}>
                <Sparkles size={14} />
                Talk it through with Ada
              </button>
            </div>
            {hints > 0 && (
              <div className="work-hint" role="status">
                {work.hints[hints - 1]}
              </div>
            )}
          </motion.div>
        </section>
        <aside className="work-system-side">
          <ProjectCanvas
            project={project}
            affected={work.affected}
            running={busy}
            metrics={
              phase === "plan" && preview ? preview.after : system.metrics
            }
            before={
              phase === "plan" && preview
                ? preview.before
                : phase === "receipt"
                  ? lastMetrics?.before
                  : undefined
            }
          />
          <div className="work-system-legend">
            {phase === "plan"
              ? "Preview · effects are planning assumptions in the model."
              : "Each decision changes this company’s operating picture."}
          </div>
          <div className="work-skills">
            <span>WHAT YOU’RE WORKING WITH</span>
            <div>
              {work.skills.map((skill) => (
                <strong key={skill}>{skill}</strong>
              ))}
            </div>
          </div>
          {(resultOption || (phase === "plan" && option)) && (
            <Artifact option={(resultOption || option)!} />
          )}
          <details className="work-reference">
            <summary>
              Look under the surface
              <ChevronDown size={14} />
            </summary>
            <p>{work.why}</p>
            <a
              className="text-link"
              href={work.reference.url}
              target="_blank"
              rel="noreferrer"
            >
              {work.reference.title}
              <ArrowUpRight size={13} />
            </a>
          </details>
        </aside>
      </div>
      <Dialog
        open={mentor}
        onClose={() => setMentor(false)}
        title="Ada · Think it through"
      >
        <div className="project-mentor">
          <span className="eyebrow">
            {project.name} / {work.title}
          </span>
          <p>
            Ada can explain this system, compare approaches, or help you
            investigate the tradeoff. Your project state is included
            automatically.
          </p>
          <div className="project-mentor-prompts">
            {[
              "Explain the moving parts in plain language",
              "Compare these approaches and their tradeoffs",
              "What evidence would change our decision?",
            ].map((text) => (
              <button key={text} onClick={() => setQuestion(text)}>
                {text}
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
          {answer && (
            <article className="project-mentor-answer">
              <p>{answer.answer}</p>
              {answer.hint && <blockquote>{answer.hint}</blockquote>}
              <a
                href={`/answers/${answer.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Open saved answer
                <ArrowUpRight size={13} />
              </a>
            </article>
          )}
          {mentorError && (
            <p className="inline-error" role="alert">
              {mentorError}
              {pendingAnswerId && <Link href={`/answers/${pendingAnswerId}`} target="_blank" rel="noreferrer">Check saved answer</Link>}
              {!user && (
                <Link href="/login">
                  Sign in
                  <ArrowRight size={13} />
                </Link>
              )}
            </p>
          )}
          <form onSubmit={ask}>
            <label htmlFor="project-question">
              What would you like to understand?
            </label>
            <textarea
              id="project-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1200}
              rows={3}
              placeholder="Ask about this company or the proposed change…"
            />
            <button
              className="button primary"
              disabled={asking || question.trim().length < 3}
            >
              {asking ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Sparkles size={15} />
              )}
              Ask Ada
            </button>
          </form>
          <small>
            {answer?.remaining !== undefined
              ? `${answer.remaining} requests remaining today.`
              : "Up to 8 Gemini requests per account each day."}{" "}
            Runs only when you ask. Practical hints are always free.
          </small>
        </div>
      </Dialog>
    </>
  );
}
function Artifact({ option }: { option: Approach }) {
  return (
    <details className="work-artifact">
      <summary>
        <Code2 size={15} />
        <span>See the implementation</span>
        <ChevronDown size={14} />
      </summary>
      <div>
        <header>
          <span>{option.artifact.filename}</span>
          <button
            aria-label="Download implementation excerpt"
            onClick={() =>
              download(option.artifact.filename, option.artifact.body)
            }
          >
            <Download size={14} />
          </button>
        </header>
        <p>
          Illustrative configuration for this approach. The practice environment
          models its effects; it does not run this file.
        </p>
        <pre>
          <code>{option.artifact.body}</code>
        </pre>
      </div>
    </details>
  );
}

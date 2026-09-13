"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Check,
  Filter,
  Globe2,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { projects } from "@/lib/projects";
import { deriveProject, emptyProjectRun } from "@/lib/project-engine";
import type { PracticeProject } from "@/lib/project-types";

const filters = [
  "All projects",
  "First steps",
  "Shipping",
  "On call",
  "Systems design",
] as const;
export function ProjectPortfolio({ board = false }: { board?: boolean }) {
  const { progress, update, ready } = useStudio();
  const router = useRouter();
  const [filter, setFilter] = useState<string>("All projects");
  const [search, setSearch] = useState("");
  const all = projects.map((project) => ({
    project,
    run: progress.portfolio.runs[project.id] || emptyProjectRun(),
    status: deriveProject(
      project,
      progress.portfolio.runs[project.id] || emptyProjectRun(),
    ),
  }));
  const shipped = all.reduce(
    (sum, item) => sum + item.status.shippedIds.length,
    0,
  );
  const active = all.filter((item) => item.run.history.length > 0);
  const skills = new Set(
    all.flatMap((item) =>
      item.project.work
        .filter((work) => item.status.shippedIds.includes(work.id))
        .flatMap((work) => work.skills),
    ),
  );
  const visible = all.filter(
    ({ project }) =>
      (filter === "All projects" || project.stage === filter) &&
      `${project.name} ${project.industry} ${project.work.flatMap((work) => work.skills).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selected = all.find(
    (item) => item.project.id === progress.portfolio.activeProject,
  );
  const allShipped = all.every(
    (item) => item.status.shippedIds.length === item.project.work.length,
  );
  const nextProject =
    (selected &&
    selected.status.shippedIds.length < selected.project.work.length &&
    active.length > 0
      ? selected.project
      : undefined) ||
    active.find(
      (item) => item.status.shippedIds.length < item.project.work.length,
    )?.project ||
    all.find((item) => item.status.shippedIds.length < item.project.work.length)
      ?.project ||
    projects[0];
  function open(project: PracticeProject, workId?: string) {
    if (!ready) return;
    update((p) => ({
      ...p,
      portfolio: {
        ...p.portfolio,
        activeProject: project.id,
        runs: {
          ...p.portfolio.runs,
          [project.id]: {
            ...(p.portfolio.runs[project.id] || emptyProjectRun()),
            ...(workId ? { activeWorkId: workId } : {}),
          },
        },
      },
    }));
    router.push(`/projects/${project.id}`);
  }
  return (
    <div className="page portfolio-page">
      <header className="portfolio-heading">
        <div>
          <div className="eyebrow">OPSSTUDIO / YOUR PRACTICE COMPANIES</div>
          <h1>
            {board ? (
              <>
                WHAT NEEDS
                <br />
                YOUR ATTENTION<span>?</span>
              </>
            ) : (
              <>
                PICK A COMPANY.
                <br />
                MAKE IT <span>WORK.</span>
              </>
            )}
          </h1>
        </div>
        <div className="portfolio-heading-note">
          <span className="portfolio-live-dot" />
          {board
            ? "Your open work, across every company."
            : "Different companies. Real engineering decisions."}
          <p>
            {board
              ? "Pick up a request, investigate an incident, or revisit a decision. Dependencies reflect what the system needs."
              : "Run a shop. Protect a clinic. Keep a payment ledger honest. Build the systems behind them, one useful change at a time."}
          </p>
        </div>
      </header>
      {!board && (
        <section className="portfolio-start">
          <div className="portfolio-start-icon">
            <Radio size={26} />
          </div>
          <div>
            <span className="eyebrow">
              {active.length
                ? "BACK ON THE TOOLS"
                : "NEW HERE? START WITH A SMALL BUSINESS"}
            </span>
            <h2>
              {active.length
                ? nextProject.name
                : "Help the community find its booking page."}
            </h2>
            <p>
              {active.length
                ? nextProject.target
                : "Start with requests, files, permissions, and your first release. Ada is nearby when you need a hand."}
            </p>
          </div>
          <button
            className="button primary"
            disabled={!ready}
            onClick={() =>
              allShipped ? router.push("/notebook") : open(nextProject)
            }
          >
            {allShipped
              ? "Open engineering record"
              : active.length
                ? "Open workspace"
                : "Take the first request"}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
      <div className="portfolio-record">
        <span>
          <Layers size={15} />
          <strong>{projects.length}</strong> practice companies
        </span>
        <span>
          <Activity size={15} />
          <strong>
            {projects.reduce((sum, p) => sum + p.work.length, 0)}
          </strong>{" "}
          requests & incidents
        </span>
        <span>
          <Check size={15} />
          <strong>{shipped}</strong> changes shipped
        </span>
        <span>
          <Globe2 size={15} />
          <strong>{skills.size}</strong> skills put to work
        </span>
      </div>
      <div className="portfolio-filterbar">
        <div role="group" aria-label="Project experience filters">
          {filters.map((value) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value}
            </button>
          ))}
        </div>
        <label>
          <Filter size={14} />
          <input
            aria-label="Find projects or skills"
            placeholder="Find a field or skill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {board ? (
        <div className="operations-board">
          {visible.map(({ project, status, run }) => (
            <section
              key={project.id}
              style={
                { "--project-accent": project.accent } as React.CSSProperties
              }
            >
              <header>
                <span className="company-monogram">
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2>{project.name}</h2>
                  <span>
                    {project.industry} · {status.shippedIds.length} shipped
                  </span>
                </div>
                <button
                  className="text-link"
                  aria-label={`${run.history.length ? "Continue work in" : "Open workspace for"} ${project.name}`}
                  disabled={!ready}
                  onClick={() => open(project)}
                >
                  Workspace
                  <ArrowUpRight size={14} />
                </button>
              </header>
              {project.work.map((work) => {
                const available = status.availableWork.some(
                  (item) => item.id === work.id,
                );
                const shipped = status.shippedIds.includes(work.id);
                const attempted = Boolean(run.selections[work.id]);
                return (
                  <button
                    className={`operations-ticket ${shipped ? "shipped" : ""} ${!available ? "waiting" : ""}`}
                    key={work.id}
                    disabled={!ready}
                    onClick={() => open(project, work.id)}
                  >
                    <span className={`request-kind ${work.kind}`}>
                      {work.kind}
                    </span>
                    <strong>{work.title}</strong>
                    <small>
                      {shipped
                        ? "Shipped · can revisit"
                        : !available
                          ? `Waiting on ${work.requires.filter((id) => !status.shippedIds.includes(id)).length} related changes`
                          : attempted
                            ? "Needs another pass"
                            : "Ready to pick up"}
                    </small>
                    <ArrowUpRight size={14} />
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="company-shelf">
          {visible.map(({ project, status, run }, index) => (
            <article
              className="company-card"
              key={project.id}
              style={
                { "--project-accent": project.accent } as React.CSSProperties
              }
            >
              <div className="company-card-top">
                <span className="company-monogram">
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <span>{project.industry}</span>
                <span className="company-stage">{project.stage}</span>
              </div>
              <div className="company-card-copy">
                <span className="company-index">
                  COMPANY /{" "}
                  {String(projects.indexOf(project) + 1).padStart(2, "0")}
                </span>
                <h2>{project.name}</h2>
                <h3>{project.tagline}</h3>
                <p>{project.description}</p>
              </div>
              <div className="company-mini-system" aria-hidden="true">
                {project.components.slice(0, 4).map((component, i) => (
                  <div key={component.id}>
                    <i />
                    <span>{component.label}</span>
                    {i < 3 && <ArrowRight size={13} />}
                  </div>
                ))}
              </div>
              <div className="company-skills">
                {[...new Set(project.work.flatMap((work) => work.skills))]
                  .slice(0, 4)
                  .map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
              </div>
              <footer>
                <span>
                  {run.history.length
                    ? `${status.shippedIds.length} / ${project.work.length} changes shipped`
                    : `${project.work.length} requests & incidents`}
                  <i
                    style={{
                      width: `${Math.max(4, (status.shippedIds.length / project.work.length) * 100)}%`,
                    }}
                  />
                </span>
                <button
                  className="text-link"
                  aria-label={`${run.history.length ? "Continue work in" : "Open workspace for"} ${project.name}`}
                  disabled={!ready}
                  onClick={() => open(project)}
                >
                  {run.history.length ? "Continue work" : "Open workspace"}
                  <ArrowUpRight size={16} />
                </button>
              </footer>
              {index === 0 && project.stage === "First steps" && (
                <span className="company-start-note">
                  A good place to get comfortable
                </span>
              )}
            </article>
          ))}
        </div>
      )}
      {!visible.length && (
        <div className="portfolio-empty">
          <h2>No workspaces match that search.</h2>
          <button
            className="text-link"
            onClick={() => {
              setSearch("");
              setFilter("All projects");
            }}
          >
            Show all projects
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <section className="portfolio-philosophy">
        <span>
          <Sparkles size={20} />
        </span>
        <div>
          <h2>Build systems you can stand behind.</h2>
          <p>
            Choose a company, weigh the options, ship a change, and investigate
            what happens. The more demanding projects introduce competing
            priorities, failures, and systems that depend on each other.
          </p>
          <p className="portfolio-practice-note">
            These are authored, interactive practice environments with synthetic
            data and modelled outcomes. Your record captures the decisions you
            actually made here.
          </p>
        </div>
        <Link href="/notebook" className="text-link">
          Your engineering record
          <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
}

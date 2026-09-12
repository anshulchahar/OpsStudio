"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  GitCommitHorizontal,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { ProjectModel } from "./project-model";
import { chapters, missions } from "@/lib/curriculum";
import { securityScore } from "@/lib/engine";

export function Blueprint() {
  return <ProjectModel compact />;
}

export function Overview() {
  const router = useRouter();
  const { progress, update } = useStudio();
  const mission = missions[progress.activeMission];
  const complete = progress.completed.length;
  const recent = progress.checkpoints.slice(-3).reverse();
  return (
    <div className="page overview-page field-workspace">
      <motion.header
        className="field-heading"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div>
          <div className="field-kicker">
            <span className="field-cross">✳</span> NORTHSTAR INSURANCE{" "}
            <span>/ PROJECT 001</span>
          </div>
          <h1>
            THE CLAIMS
            <br />
            PLATFORM<span className="field-period">.</span>
          </h1>
        </div>
        <div className="field-intro">
          <span className="field-edition">BUILD → OBSERVE → UNDERSTAND</span>
          <p>
            A claim travels through four services. <br />
            Build the path. Secure every boundary. <br />
            Prove it survives a failure.
          </p>
          <Link href="/journey">
            Explore the project <ArrowUpRight size={16} />
          </Link>
        </div>
      </motion.header>
      <motion.div
        className="project-desk"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <section
          className="architecture-sheet"
          aria-label="Explore the project architecture"
        >
          <ProjectModel state={progress.state} />
        </section>
        <aside className="assignment-sheet">
          <div className="assignment-top">
            <span>YOUR NEXT MOVE</span>
            <span className="assignment-index">
              {String(progress.activeMission + 1).padStart(2, "0")}
              <small> / 20</small>
            </span>
          </div>
          <div className="assignment-main">
            <span className="assignment-chapter">
              CHAPTER {String(mission.chapter + 1).padStart(2, "0")} /{" "}
              {chapters[mission.chapter].title}
            </span>
            <h2>{mission.title}</h2>
            <p>
              {mission.id === "first-request"
                ? "A customer submits a claim. Follow it through your system and discover what each component does."
                : mission.subtitle}
            </p>
          </div>
          <div className="assignment-bottom">
            <div className="assignment-meta">
              <span>
                <Clock3 size={13} /> {mission.duration} MINUTES
              </span>
              <span>GUIDED SIMULATION</span>
            </div>
            <Link href="/studio" className="button primary assignment-cta">
              {complete ? "Resume fieldwork" : "Open the workbench"}
              <ArrowRight size={18} />
            </Link>
            <p>No code to type. Every change comes with evidence.</p>
          </div>
          <div className="assignment-expectation">
            <span>IN THIS MISSION</span>
            <div>
              <span>01</span>Inspect the system
            </div>
            <div>
              <span>02</span>
              {mission.cta}
            </div>
            <div>
              <span>03</span>Explain the result
            </div>
          </div>
        </aside>
      </motion.div>
      <div className="project-instruments" aria-label="Project progress">
        <div>
          <span className="instrument-label">MISSIONS COMPLETED</span>
          <strong>
            {String(complete).padStart(2, "0")}
            <small>/20</small>
          </strong>
          <div className="instrument-segments">
            {missions.map((m) => (
              <i
                key={m.id}
                className={progress.completed.includes(m.id) ? "done" : ""}
              />
            ))}
          </div>
        </div>
        <div>
          <span className="instrument-label">SECURITY CONTROLS</span>
          <strong>
            {securityScore(progress.state)}
            <small>%</small>
          </strong>
          <span className="instrument-note">Enabled in your simulation</span>
        </div>
        <div>
          <span className="instrument-label">REAL VERIFICATION</span>
          <strong>
            02<small> LABS</small>
          </strong>
          <span className="instrument-note">Isolated Node.js environments</span>
        </div>
      </div>
      <section className="field-syllabus">
        <div className="field-section-heading">
          <div>
            <span className="field-kicker">THE PROJECT, IN FIVE CHAPTERS</span>
            <h2>
              From first request
              <br />
              to resilient system.
            </h2>
          </div>
          <p>
            One evolving service. Twenty decisions.
            <br />
            Every change leaves something you can inspect.
          </p>
        </div>
        <div className="chapter-register">
          {chapters.map((chapter, index) => {
            const chapterMissions = missions.filter((m) => m.chapter === index);
            const done = chapterMissions.filter((m) =>
              progress.completed.includes(m.id),
            ).length;
            const nextIndex = missions.findIndex(
              (m) => m.chapter === index && !progress.completed.includes(m.id),
            );
            return (
              <button
                className={`chapter-entry ${index === mission.chapter ? "current" : ""}`}
                key={chapter.title}
                onClick={() => {
                  update((p) => ({
                    ...p,
                    activeMission: nextIndex < 0 ? index * 4 : nextIndex,
                  }));
                  router.push("/studio");
                }}
              >
                <span className="chapter-entry-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{chapter.title}</h3>
                  <p>{chapter.description}</p>
                </div>
                <span className="chapter-entry-progress">
                  <span className="chapter-progress-pips" aria-hidden="true">
                    {chapterMissions.map((m) => (
                      <i
                        key={m.id}
                        className={
                          progress.completed.includes(m.id) ? "done" : ""
                        }
                      />
                    ))}
                  </span>
                  {done === 4 ? <Check size={16} /> : `${done} / 4`}
                  <small>
                    {index === mission.chapter ? "IN PROGRESS" : "MISSIONS"}
                  </small>
                </span>
                <ArrowUpRight size={21} />
              </button>
            );
          })}
        </div>
      </section>
      <section className="field-log">
        <div>
          <span className="field-kicker">WORKING RECORD</span>
          <h2>Your system has a history.</h2>
          <Link href="/notebook">
            Open notebook <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="field-log-entries">
          {recent.length ? (
            recent.map((item) => (
              <div key={item.id}>
                <GitCommitHorizontal size={18} />
                <strong>{item.title}</strong>
                <time>
                  {new Date(item.at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </time>
              </div>
            ))
          ) : (
            <div className="field-log-empty">
              <GitCommitHorizontal size={22} />
              <p>
                No changes yet. Run your first mission to create a checkpoint
                you can return to.
              </p>
            </div>
          )}
        </div>
      </section>
      <div className="field-footnote">
        <span>FICTIONAL COMPANY. REAL ENGINEERING CONCEPTS.</span>
        <span>SIMULATIONS + SELECTED LIVE LABS</span>
      </div>
    </div>
  );
}

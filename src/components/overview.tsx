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
  LockKeyhole,
  Award,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { ProjectModel } from "./project-model";
import { chapters, missions } from "@/lib/curriculum";
import {
  getLearningProgress,
  isMissionUnlocked,
  MISSION_XP,
} from "@/lib/learning-progress";

export function Blueprint() {
  return <ProjectModel compact />;
}

export function Overview() {
  const router = useRouter();
  const { progress, update, ready } = useStudio();
  const learning = getLearningProgress(progress.completed);
  const nextIndex = learning.nextMissionIndex;
  const mission = missions[nextIndex ?? missions.length - 1];
  const complete = learning.completedCount;
  const firstBadgeRemaining = missions.filter(
    (item) => item.chapter === 0 && !progress.completed.includes(item.id),
  ).length;
  const recent = progress.checkpoints.slice(-3).reverse();
  function openMission(index: number) {
    if (!ready || !isMissionUnlocked(index, progress.completed)) return;
    update((p) => ({ ...p, activeMission: index }));
    router.push("/studio");
  }
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
          <span className="field-edition">ONE MISSION AT A TIME</span>
          <p>
            Make a change. See what happens. <br />
            Make your call, then unlock the next mission.
          </p>
          <Link href="/journey">
            View your mission path <ArrowUpRight size={16} />
          </Link>
        </div>
      </motion.header>
      <motion.div
        className="project-desk"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <figure className="architecture-sheet overview-system-preview">
          <figcaption>
            <span>THE SYSTEM YOU’LL BUILD</span>
            <span>SIMULATION</span>
          </figcaption>
          <div className="static-project-model" inert aria-hidden="true">
            <ProjectModel state={progress.state} compact />
          </div>
          <p className="overview-system-path">
            Portal <ArrowRight size={12} /> Gateway <ArrowRight size={12} />
            Service <ArrowRight size={12} /> Database
          </p>
          <p className="overview-system-note">
            Each mission adds to this system. You’ll explore it as you go.
          </p>
        </figure>
        <aside className="assignment-sheet">
          <div className="assignment-top">
            <span>
              {nextIndex === null ? "PROJECT COMPLETE" : "YOUR NEXT MISSION"}
            </span>
            <span className="assignment-index">
              {String((nextIndex ?? missions.length - 1) + 1).padStart(2, "0")}
              <small> / 20</small>
            </span>
          </div>
          <div className="assignment-main">
            <span className="assignment-chapter">
              CHAPTER {String(mission.chapter + 1).padStart(2, "0")} /{" "}
              {chapters[mission.chapter].title}
            </span>
            <h2>
              {nextIndex === null ? "You built the whole path." : mission.title}
            </h2>
            <p>
              {nextIndex === null
                ? "Twenty changes, twenty decisions. Revisit a mission to see how the pieces work together."
                : mission.id === "first-request"
                  ? "A customer submits a claim. Follow it through your system and discover what each component does."
                  : mission.subtitle}
            </p>
          </div>
          <div className="assignment-bottom">
            <div className="assignment-meta">
              <span>
                <Clock3 size={13} /> {mission.duration} MINUTES
              </span>
              <span>
                {nextIndex === null
                  ? "ALL MISSIONS VERIFIED"
                  : `+${MISSION_XP} XP`}
              </span>
            </div>
            {nextIndex === null ? (
              <Link href="/journey" className="button primary assignment-cta">
                Review your missions <ArrowRight size={18} />
              </Link>
            ) : (
              <button
                className="button primary assignment-cta"
                disabled={!ready}
                onClick={() => openMission(nextIndex)}
              >
                {!ready
                  ? "Loading your progress…"
                  : complete
                    ? `Continue mission ${nextIndex + 1}`
                    : "Start mission 1"}
                <ArrowRight size={18} />
              </button>
            )}
            <p>No code to type. Hints whenever you need them.</p>
          </div>
          <div className="assignment-expectation">
            <span>YOUR THREE STEPS</span>
            <div>
              <span>01</span>Make a change
            </div>
            <div>
              <span>02</span>
              See the result
            </div>
            <div>
              <span>03</span>Make your call
            </div>
          </div>
        </aside>
      </motion.div>
      <div
        className="project-instruments learning-instruments"
        aria-label="Your learning progress"
      >
        <div className="learning-level-instrument">
          <span className="instrument-label">
            LEVEL {learning.level} · {learning.levelTitle.toUpperCase()}
          </span>
          <strong>
            {learning.xp}
            <small> XP</small>
          </strong>
          <div
            className="learning-level-track"
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={learning.levelProgress}
          >
            <span style={{ width: `${learning.levelProgress}%` }} />
          </div>
          <span className="instrument-note">
            {complete === missions.length
              ? "Every mission verified"
              : "100 XP for each verified decision"}
          </span>
        </div>
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
          <span className="instrument-label">CHAPTER BADGES</span>
          <strong>
            {String(learning.earnedBadges.length).padStart(2, "0")}
            <small> / 5</small>
          </strong>
          <span className="instrument-note">
            {learning.earnedBadges.at(-1)?.title ??
              `${firstBadgeRemaining} ${firstBadgeRemaining === 1 ? "mission" : "missions"} to your first badge`}
          </span>
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
            const chapterNextIndex = missions.findIndex(
              (m) => m.chapter === index && !progress.completed.includes(m.id),
            );
            const targetIndex =
              chapterNextIndex < 0 ? index * 4 : chapterNextIndex;
            const unlocked = isMissionUnlocked(targetIndex, progress.completed);
            const badge = learning.earnedBadges.find(
              (item) => item.chapter === index,
            );
            return (
              <button
                className={`chapter-entry ${index === mission.chapter && nextIndex !== null ? "current" : ""} ${unlocked ? "" : "locked"}`}
                key={chapter.title}
                disabled={!ready || !unlocked}
                onClick={() => openMission(targetIndex)}
              >
                <span className="chapter-entry-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{chapter.title}</h3>
                  <p>
                    {!unlocked
                      ? `Complete mission ${(nextIndex ?? 0) + 1} to keep moving along the path.`
                      : chapter.description}
                  </p>
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
                  {badge ? (
                    <Award size={16} />
                  ) : !unlocked ? (
                    <LockKeyhole size={14} />
                  ) : (
                    `${done} / 4`
                  )}
                  <small>
                    {badge
                      ? "BADGE EARNED"
                      : !unlocked
                        ? "UPCOMING"
                        : "UP NEXT"}
                  </small>
                </span>
                {done === 4 ? <Check size={18} /> : <ArrowUpRight size={21} />}
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

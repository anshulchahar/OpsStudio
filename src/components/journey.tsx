"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  Network,
  GitBranch,
  ShieldCheck,
  Activity,
  Layers,
  FlaskConical,
  LockKeyhole,
  Award,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { chapters, missions } from "@/lib/curriculum";
import {
  getLearningProgress,
  isMissionUnlocked,
  MISSION_XP,
} from "@/lib/learning-progress";
export function Journey() {
  const { progress, update, ready } = useStudio();
  const router = useRouter();
  const learning = getLearningProgress(progress.completed);
  const nextIndex = learning.nextMissionIndex;
  const nextMission = nextIndex === null ? null : missions[nextIndex];
  function openMission(index: number) {
    if (!ready || !isMissionUnlocked(index, progress.completed)) return;
    update((p) => ({ ...p, activeMission: index }));
    router.push("/studio");
  }
  return (
    <div className="page journey-page guided-journey">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LEARNING PATH</div>
          <h1>
            ONE MISSION. <span>THEN THE NEXT.</span>
          </h1>
          <p>
            Build a change, see the result, and make your call. Every verified
            mission earns {MISSION_XP} XP and opens the next step.
          </p>
        </div>
        <div className="journey-total">
          <strong>
            {learning.completedCount}
            <span>/20</span>
          </strong>
          <small>missions completed</small>
        </div>
      </div>
      <section className="journey-next" aria-label="Your next mission">
        <div className="journey-next-copy">
          <span className="eyebrow">
            {nextMission ? "UP NEXT" : "PROJECT COMPLETE"}
          </span>
          <h2>{nextMission?.title ?? "Your claims platform is complete."}</h2>
          <p>
            {nextMission
              ? `Mission ${nextIndex! + 1} · ${nextMission.duration} minutes · Guided simulation`
              : "Revisit any mission below. Your learning record stays with you."}
          </p>
        </div>
        {nextIndex !== null ? (
          <button
            className="button primary"
            disabled={!ready}
            onClick={() => openMission(nextIndex)}
          >
            {learning.completedCount
              ? `Continue mission ${nextIndex + 1}`
              : "Start mission 1"}
            <ArrowRight size={16} />
          </button>
        ) : (
          <Link href="/notebook" className="button primary">
            Open your notebook <ArrowRight size={16} />
          </Link>
        )}
      </section>
      <div className="journey-learning-record">
        <div>
          <span className="journey-level-number">
            {String(learning.level).padStart(2, "0")}
          </span>
          <span>
            <small>YOUR LEVEL</small>
            <strong>{learning.levelTitle}</strong>
          </span>
        </div>
        <div className="journey-xp-progress">
          <span>
            <strong>{learning.xp} XP</strong>
            <small>
              {learning.completedCount === missions.length
                ? "All missions verified"
                : "Every four missions, a new level"}
            </small>
          </span>
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
        </div>
        <span className="journey-badge-count">
          <Award size={21} />
          <strong>{learning.earnedBadges.length} / 5</strong> badges earned
        </span>
      </div>
      <div className="journey-chapters">
        {chapters.map((chapter, index) => {
          const Icon = [Network, GitBranch, ShieldCheck, Activity, Layers][
            index
          ];
          const chapterMissions = missions.filter((m) => m.chapter === index);
          const done = chapterMissions.filter((m) =>
            progress.completed.includes(m.id),
          ).length;
          const badge = learning.earnedBadges.find(
            (item) => item.chapter === index,
          );
          return (
            <section
              key={chapter.title}
              className={`journey-chapter ${chapter.color} ${badge ? "chapter-earned" : ""}`}
            >
              <div className="chapter-rail">
                <span className={`chapter-icon ${chapter.color}`}>
                  {badge ? <Award size={23} /> : <Icon size={23} />}
                </span>
                <i />
              </div>
              <div className="journey-chapter-body">
                <div className="journey-chapter-heading">
                  <div>
                    <span className="eyebrow">
                      CHAPTER {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{chapter.title}</h2>
                    <p>{chapter.description}</p>
                  </div>
                  <span className="journey-chapter-reward">
                    {badge ? (
                      <>
                        <Award size={14} />
                        {badge.title}
                      </>
                    ) : (
                      <>
                        {done}/4 complete
                        <small>Complete all four to earn a badge</small>
                      </>
                    )}
                  </span>
                </div>
                <div className="journey-missions">
                  {chapterMissions.map((m) => {
                    const missionIndex = missions.indexOf(m);
                    const completed = progress.completed.includes(m.id);
                    const unlocked = isMissionUnlocked(
                      missionIndex,
                      progress.completed,
                    );
                    const recommended = missionIndex === nextIndex;
                    return (
                      <button
                        key={m.id}
                        className={`${completed ? "completed" : ""} ${recommended ? "recommended" : ""} ${unlocked ? "" : "locked"}`}
                        disabled={!ready || !unlocked}
                        onClick={() => openMission(missionIndex)}
                        aria-current={recommended ? "step" : undefined}
                      >
                        <span className="mission-circle">
                          {completed ? (
                            <Check size={15} />
                          ) : !unlocked ? (
                            <LockKeyhole size={12} />
                          ) : (
                            String(missionIndex + 1).padStart(2, "0")
                          )}
                        </span>
                        <div className="journey-mission-copy">
                          <h3>
                            {m.title}
                            {recommended && (
                              <span className="journey-next-label">
                                UP NEXT
                              </span>
                            )}
                          </h3>
                          <p>
                            {!unlocked
                              ? `Complete mission ${(nextIndex ?? 0) + 1} first`
                              : completed
                                ? "Decision verified · Replay any time"
                                : m.subtitle}
                          </p>
                        </div>
                        <span className="mission-time">
                          {m.lab && <FlaskConical size={14} />}
                          <Clock3 size={13} />
                          {m.duration} min
                        </span>
                        <span className="journey-mission-xp">
                          {completed
                            ? `${MISSION_XP} XP earned`
                            : `+${MISSION_XP} XP`}
                        </span>
                        {unlocked && <ArrowRight size={17} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="journey-note">
        <ShieldCheck size={20} />
        <p>
          <strong>Hints help. They never cost you XP.</strong> A correct
          decision after a mission earns its reward once. Chapters use
          simulations, with two optional recipes that run real HTTP checks in
          isolated VMs.
        </p>
      </div>
    </div>
  );
}

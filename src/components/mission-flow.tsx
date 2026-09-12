"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
} from "lucide-react";
import { missions } from "@/lib/curriculum";
import { getLearningProgress, MISSION_XP } from "@/lib/learning-progress";
import type { Execution } from "@/lib/engine";

export type MissionStage = "build" | "observe" | "decide" | "complete";

export function MissionFlow({
  missionIndex,
  stage,
  busy,
  ready,
  completed,
  earnedNow,
  completedIds,
  execution,
  steps,
  selectedDecision,
  error,
  unlocked,
  hint,
  hintNumber,
  onRun,
  onStage,
  onDecision,
  onMission,
  onHint,
}: {
  missionIndex: number;
  stage: MissionStage;
  busy: boolean;
  ready: boolean;
  completed: boolean;
  earnedNow: boolean;
  completedIds: string[];
  execution: Execution | null;
  steps: string[];
  selectedDecision: number | null;
  error: string;
  unlocked: boolean;
  hint: string | null;
  hintNumber: number;
  onRun: () => void;
  onStage: (stage: MissionStage) => void;
  onDecision: (index: number) => void;
  onMission: (index: number) => void;
  onHint: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready || !panelRef.current) return;
    const panel = panelRef.current;
    panel.querySelector("h2")?.focus({ preventScroll: true });
    const top = panel.getBoundingClientRect().top;
    if (top < 72 || top > window.innerHeight - 160) {
      panel.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [stage, missionIndex, ready]);
  const mission = missions[missionIndex];
  const learning = getLearningProgress(completedIds);
  const next = learning.nextMissionIndex;
  const chapterBadge = learning.earnedBadges.find(
    (badge) => badge.chapter === mission.chapter,
  );
  const phase =
    stage === "complete" ? 3 : ["build", "observe", "decide"].indexOf(stage);

  return (
    <>
      <ol className="mission-step-rail" aria-label="Mission steps">
        {["Make a change", "See the result", "Make a decision"].map(
          (label, index) => (
            <li
              key={label}
              className={
                index < phase ? "done" : index === phase ? "current" : ""
              }
              aria-current={index === phase ? "step" : undefined}
            >
              <span>{index < phase ? <Check size={14} /> : index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <section
        className={`mission-action-panel stage-${stage}`}
        aria-label="Your next action"
        aria-busy={busy}
        ref={panelRef}
      >
        <motion.div
          key={`${mission.id}-${stage}-${unlocked}`}
          className="mission-stage-content"
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {!unlocked ? (
            <>
              <span className="eyebrow">ONE STEP AT A TIME</span>
              <h2 tabIndex={-1}>Build the foundation first.</h2>
              <p>
                This mission builds on earlier changes. Your next mission sets
                up what you need.
              </p>
              {next !== null && (
                <button
                  className="button primary flow-primary"
                  disabled={!ready || busy}
                  onClick={() => onMission(next)}
                >
                  Go to mission {next + 1}
                  <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : stage === "build" ? (
            <>
              <div className="stage-kicker">
                <span className="eyebrow">
                  {busy ? "YOUR CHANGE IS RUNNING" : "YOUR MISSION"}
                </span>
                <span className="xp-preview">
                  {completed ? "PRACTICE RUN" : `+${MISSION_XP} XP`}
                </span>
              </div>
              <h2 tabIndex={-1}>{mission.subtitle}</h2>
              <p>{mission.brief}</p>
              {busy ? (
                <div className="flow-running" role="status">
                  <span>
                    <LoaderCircle className="spin" size={17} />
                    Applying your change…
                  </span>
                  <p>{steps.at(-1) || "Preparing your simulated system"}</p>
                  <div className="flow-running-track">
                    <motion.i
                      initial={{ width: "8%" }}
                      animate={{
                        width: `${Math.min(95, 15 + steps.length * 16)}%`,
                      }}
                    />
                  </div>
                  <small>Watch the highlighted components on the map.</small>
                </div>
              ) : (
                <>
                  {error && (
                    <p className="flow-error" role="alert">
                      {error} Review earlier missions from the mission menu to
                      rebuild a restored system.
                    </p>
                  )}
                  <button
                    className="button primary flow-primary"
                    disabled={!ready || busy}
                    onClick={onRun}
                  >
                    <Play size={15} />
                    {ready ? mission.cta : "Loading your progress…"}
                    <ArrowRight size={16} />
                  </button>
                  <span className="flow-reassurance">
                    OpsStudio applies the change. You watch what happens.
                  </span>
                  <button
                    className="text-link flow-replay"
                    disabled={hintNumber >= 3}
                    onClick={onHint}
                  >
                    <Lightbulb size={13} />
                    {hintNumber ? `Next hint · ${hintNumber}/3` : "Get a hint"}
                  </button>
                </>
              )}
            </>
          ) : stage === "observe" && execution ? (
            <>
              <span className="eyebrow">STEP 2 · SEE THE RESULT</span>
              <h2 tabIndex={-1}>Here’s what changed.</h2>
              <p>{execution.summary}</p>
              <div className="flow-evidence">
                {execution.evidence.map((item) => (
                  <div
                    key={item.label}
                    className={`flow-evidence-item ${item.status}`}
                  >
                    <span>
                      {item.status === "pass" ? <Check size={14} /> : "!"}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="button primary flow-primary"
                disabled={busy}
                onClick={() => onStage("decide")}
              >
                Make your decision
                <ArrowRight size={16} />
              </button>
              <span className="flow-reassurance">
                One small decision to connect the result to the idea.
              </span>
            </>
          ) : stage === "decide" ? (
            <>
              <span className="eyebrow">STEP 3 · MAKE A DECISION</span>
              <h2 tabIndex={-1}>{mission.decision.question}</h2>
              <div className="flow-decisions">
                {mission.decision.options.map((option, index) => (
                  <button
                    key={option}
                    className={selectedDecision === index ? "incorrect" : ""}
                    disabled={busy}
                    onClick={() => onDecision(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                ))}
              </div>
              {selectedDecision !== null && (
                <p className="flow-retry" role="status">
                  Not quite. {mission.hints[1]} Try another answer—your XP stays
                  the same.
                </p>
              )}
              <div className="flow-secondary-actions">
                <button
                  className="text-link"
                  onClick={() => onStage("observe")}
                >
                  <ChevronLeft size={14} />
                  See the result again
                </button>
                <button
                  className="text-link"
                  disabled={hintNumber >= 3}
                  onClick={onHint}
                >
                  <Lightbulb size={14} />
                  {hintNumber ? `Next hint · ${hintNumber}/3` : "Get a hint"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mission-reward-mark" aria-hidden="true">
                <Award size={38} />
                {earnedNow && (
                  <>
                    <i />
                    <i />
                    <i />
                    <i />
                  </>
                )}
              </div>
              <span className="eyebrow">
                {earnedNow ? "DECISION VERIFIED" : "ALREADY IN YOUR TOOLKIT"}
              </span>
              <h2 tabIndex={-1}>Mission complete.</h2>
              <p>{mission.decision.explanation}</p>
              <div className="mission-earned">
                <strong>
                  {earnedNow ? "+" : ""}
                  {MISSION_XP} XP
                </strong>
                <span>
                  {earnedNow
                    ? "earned for understanding"
                    : "already earned · replays are practice"}
                </span>
              </div>
              {chapterBadge && (
                <div className="mission-badge-earned">
                  <Award size={18} />
                  <div>
                    <strong>{chapterBadge.title}</strong>
                    <span>
                      Chapter {mission.chapter + 1} badge earned · all 4
                      missions complete
                    </span>
                  </div>
                </div>
              )}
              {next !== null ? (
                <button
                  className="button primary flow-primary"
                  disabled={!ready || busy}
                  onClick={() => onMission(next)}
                >
                  Start mission {next + 1}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <Link className="button primary flow-primary" href="/journey">
                  See your completed journey
                  <ArrowRight size={16} />
                </Link>
              )}
              {next !== null && (
                <span className="flow-next-title">
                  Up next: {missions[next].title}
                </span>
              )}
              <button
                className="text-link flow-replay"
                disabled={busy}
                onClick={() => onStage("build")}
              >
                <RotateCcw size={13} />
                Replay this mission
              </button>
            </>
          )}
          {hint && stage !== "complete" && (
            <div className="flow-inline-hint" role="status">
              <Lightbulb size={16} />
              <p>
                <strong>Hint {hintNumber} of 3</strong>
                {hint}
              </p>
            </div>
          )}
        </motion.div>
      </section>
    </>
  );
}

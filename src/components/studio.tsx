"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Award,
  LockKeyhole,
  Code2,
  Download,
  ExternalLink,
  FlaskConical,
  History,
  Lightbulb,
  LoaderCircle,
  Network,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { SystemMap, componentDetails } from "./system-map";
import { Dialog } from "./dialog";
import { chapters, missions } from "@/lib/curriculum";
import {
  executeAction,
  risks,
  type Evidence,
  type Execution,
  type ActionId,
} from "@/lib/engine";
import { artifacts } from "@/lib/artifacts";
import { MissionFlow, type MissionStage } from "./mission-flow";
import {
  getLearningProgress,
  isMissionUnlocked,
} from "@/lib/learning-progress";

type Answer = {
  missionId: string;
  id: string;
  answer: string;
  hint: string;
  action: ActionId | null;
  remaining?: number;
  cached?: boolean;
};
function saveFile(name: string, body: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const actionTargets: Record<ActionId, string[]> = {
  trace: ["browser", "gateway", "database", "browser"],
  commit: ["repository"],
  test: ["api"],
  deploy: ["pipeline", "api"],
  containerize: ["api"],
  pipeline: ["repository", "pipeline", "api"],
  tls: ["gateway"],
  secrets: ["secrets", "api"],
  authenticate: ["api"],
  authorize: ["api", "database"],
  scan: ["pipeline"],
  sign: ["pipeline"],
  observe: ["monitor", "api"],
  scale: ["api"],
  backup: ["database"],
  recover: ["database", "api"],
  "network-policy": ["gateway", "api", "database"],
  gitops: ["repository", "pipeline", "api"],
  reconcile: ["repository", "api"],
  budget: ["monitor", "api"],
  outage: ["api"],
  drift: ["api"],
};

export function Studio() {
  const { progress } = useStudio();
  return <MissionStudio key={progress.activeMission} />;
}

function MissionStudio() {
  const { progress, update, user, notify, sync, ready } = useStudio();
  const mission = missions[progress.activeMission];
  const [tab, setTab] = useState<"evidence" | "artifacts">("evidence");
  const [stageOverride, setStage] = useState<MissionStage | null>(null);
  const [earnedNow, setEarnedNow] = useState(false);
  const [missionExecution, setMissionExecution] = useState<Execution | null>(
    null,
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const [runError, setRunError] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"mentor" | "inspect">("mentor");
  const [busy, setBusy] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [execution, setExecution] = useState<
    (Execution & { missionId: string; action: ActionId }) | null
  >(null);
  const [missionMenu, setMissionMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [hintCounts, setHintCounts] = useState<Record<string, number>>({});
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [mentorError, setMentorError] = useState("");
  const [decision, setDecision] = useState<{
    missionId: string;
    index: number;
  } | null>(null);
  const [artifactIndex, setArtifactIndex] = useState(0);
  const [labOpen, setLabOpen] = useState(false);
  const [labBusy, setLabBusy] = useState(false);
  const [labResult, setLabResult] = useState<{
    results: Evidence[];
    limitations: string;
    id: string;
  } | null>(null);
  const [labError, setLabError] = useState("");
  const [actor, setActor] = useState("customer-a");
  const [probe, setProbe] = useState<{ status: number; text: string } | null>(
    null,
  );
  const runToken = useRef(0);
  useEffect(
    () => () => {
      runToken.current++;
    },
    [],
  );
  const currentExecution =
    execution?.missionId === mission.id ? execution : null;
  const completed = progress.completed.includes(mission.id);
  const learning = getLearningProgress(progress.completed);
  const unlocked = isMissionUnlocked(
    progress.activeMission,
    progress.completed,
  );
  const stage = stageOverride || (completed ? "complete" : "build");
  const hints = hintCounts[mission.id] || 0;
  const currentAnswer = answer?.missionId === mission.id ? answer : null;
  const inspected = focus ? componentDetails[focus] : null;
  const files = artifacts(progress.state);
  const selectedFile = files[artifactIndex];
  const inspect = useCallback((id: string) => {
    setFocus(id);
    setSideTab("inspect");
    setGuideOpen(true);
  }, []);

  async function run(action: ActionId = mission.action) {
    if (busy || !ready || !unlocked) return;
    const token = ++runToken.current;
    try {
      const result = executeAction(progress.state, action);
      const before = progress.state;
      setBusy(true);
      setRunError("");
      setSteps([]);
      setTab("evidence");
      if (action === mission.action) {
        setStage("build");
        setMissionExecution(null);
        setEarnedNow(false);
        setDecision(null);
      }
      setExecution(null);
      for (const [index, step] of result.steps.entries()) {
        const targets = actionTargets[action];
        setActiveNode(targets[Math.min(index, targets.length - 1)]);
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (token !== runToken.current) return;
        setSteps((old) => [...old, step]);
      }
      update((p) => ({
        ...p,
        state: result.state,
        checkpoints: [
          ...p.checkpoints,
          {
            id: crypto.randomUUID(),
            title: `Before ${action === mission.action ? mission.title : action}`,
            at: new Date().toISOString(),
            state: before,
          },
        ].slice(-30),
      }));
      setExecution({ ...result, missionId: mission.id, action });
      if (action === mission.action) {
        setMissionExecution(result);
        setStage("observe");
      }
      setBusy(false);
      setActiveNode(null);
      notify(result.summary);
    } catch (error) {
      setBusy(false);
      setActiveNode(null);
      const message =
        error instanceof Error ? error.message : "That change could not run.";
      setRunError(message);
      notify(message);
    }
  }
  function chooseMission(index: number) {
    if (busy || !ready || !isMissionUnlocked(index, progress.completed)) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    update((p) => ({ ...p, activeMission: index }));
    setMissionMenu(false);
    setDecision(null);
    setSteps([]);
    setFocus(null);
    setSideTab("mentor");
    setProbe(null);
  }
  function chooseDecision(index: number) {
    if (!ready || busy || stage !== "decide" || !missionExecution) return;
    setDecision({ missionId: mission.id, index });
    if (index === mission.decision.correct && missionExecution) {
      update((p) => ({
        ...p,
        completed: [...new Set([...p.completed, mission.id])],
      }));
      setEarnedNow(!completed);
      setStage("complete");
      notify(
        completed
          ? "Practice complete. Your XP is already saved."
          : "Mission complete. +100 XP earned.",
      );
    }
  }
  async function ask(event?: React.FormEvent) {
    event?.preventDefault();
    if (!question.trim() || asking) return;
    if (!user) {
      setMentorError(
        "Sign in to ask Gemini. You can use the guided hints without an account.",
      );
      return;
    }
    setAsking(true);
    setMentorError("");
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          missionId: mission.id,
          state: progress.state,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The mentor is unavailable.");
      setAnswer({ ...data, missionId: mission.id });
      setQuestion("");
    } catch (error) {
      setMentorError(
        error instanceof Error ? error.message : "The mentor could not answer.",
      );
    } finally {
      setAsking(false);
    }
  }
  async function runLab() {
    if (!mission.lab || labBusy) return;
    setLabOpen(true);
    setLabError("");
    setLabResult(null);
    if (!user) {
      setLabError(
        "Sign in to run this recipe in a real, isolated environment. Your simulation is still available.",
      );
      return;
    }
    setLabBusy(true);
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipe: mission.lab }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The lab is unavailable.");
      setLabResult(data);
    } catch (error) {
      setLabError(
        error instanceof Error ? error.message : "The lab could not finish.",
      );
    } finally {
      setLabBusy(false);
    }
  }
  function sendProbe() {
    let status = 200,
      text = "Claim returned to the requester";
    if (!progress.state.healthy) {
      status = 503;
      text = "Service unavailable";
    } else if (progress.state.auth && actor === "anonymous") {
      status = 401;
      text = "A verified session is required";
    } else if (progress.state.authorization && actor !== "customer-a") {
      status = 403;
      text = "This claim belongs to another customer";
    }
    setProbe({ status, text });
  }
  return (
    <div className="studio-page">
      <div className="studio-heading guided-studio-heading">
        <div>
          <div className="eyebrow">
            NORTHSTAR INSURANCE / YOUR LEARNING JOURNEY
          </div>
          <h1>ONE CHANGE AT A TIME.</h1>
        </div>
        <div
          className="studio-learning-score"
          aria-label={`Level ${learning.level}, ${learning.xp} XP`}
        >
          <Award size={22} />
          <div>
            <strong>
              Level {learning.level} <span>· {learning.levelTitle}</span>
            </strong>
            <small>
              {learning.xp.toLocaleString()} XP · {learning.completedCount}/
              {missions.length} missions
            </small>
          </div>
        </div>
      </div>
      <div className="guided-mission-strip">
        <span className="guided-mission-number">
          {String(progress.activeMission + 1).padStart(2, "0")}
        </span>
        <div>
          <span className="eyebrow">
            CHAPTER {mission.chapter + 1} · {chapters[mission.chapter].title}
          </span>
          <h2>{mission.title}</h2>
        </div>
        <span className="guided-duration">
          <Clock3 size={14} />
          {mission.duration} min
        </span>
        <button
          className="text-link mission-browse"
          onClick={() => setMissionMenu(true)}
          disabled={busy || !ready}
        >
          Missions
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="guided-workspace">
        <MissionFlow
          missionIndex={progress.activeMission}
          stage={stage}
          busy={busy}
          ready={ready}
          completed={completed}
          earnedNow={earnedNow}
          completedIds={progress.completed}
          execution={missionExecution}
          steps={steps}
          selectedDecision={
            decision?.missionId === mission.id ? decision.index : null
          }
          error={runError}
          unlocked={unlocked}
          hint={hints ? mission.hints[hints - 1] : null}
          hintNumber={hints}
          onRun={() => run()}
          onStage={setStage}
          onDecision={chooseDecision}
          onMission={chooseMission}
          onHint={() =>
            setHintCounts((p) => ({
              ...p,
              [mission.id]: Math.min(hints + 1, 3),
            }))
          }
        />
        <div className="mission-scene">
          <div className="mission-scene-heading">
            <span>
              <Network size={15} />
              Your system
            </span>
            <span className="simulation-badge">
              <span />
              Simulation
            </span>
          </div>
          <SystemMap
            state={progress.state}
            running={busy}
            activeNode={activeNode}
            focus={focus}
            onInspect={inspect}
          />
          <div className="mission-scene-caption">
            <span className={`status-dot ${busy ? "is-running" : ""}`} />
            {busy
              ? "Following the change through your system"
              : stage === "build"
                ? "Your change will appear here. Select a component to explore."
                : "Your system now reflects the change you made."}
          </div>
        </div>
      </div>
      <div className="mission-support">
        <div className="mission-support-label">
          <span className="guide-mark" aria-hidden="true">
            a/
          </span>
          <div>
            <strong>A little help, when you need it.</strong>
            <span>Hints never cost XP.</span>
          </div>
        </div>

        <button
          className="text-link"
          onClick={() => {
            setSideTab("mentor");
            setGuideOpen(true);
          }}
        >
          <Sparkles size={15} />
          Ask Ada
        </button>
      </div>
      <details className="studio-explore">
        <summary>
          <div>
            <Code2 size={17} />
            <strong>Explore tools</strong>
            <span>Code, requests, checkpoints & experiments</span>
          </div>
          <ChevronDown size={16} />
        </summary>
        <div className="studio-explore-body">
          <section className="canvas-card">
            <div className="canvas-toolbar">
              <div
                className="canvas-tabs"
                role="tablist"
                aria-label="System views"
              >
                {(
                  [
                    { id: "evidence", label: "Evidence", icon: Terminal },
                    { id: "artifacts", label: "Artifacts", icon: Code2 },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "selected" : ""}
                    onClick={() => setTab(id)}
                  >
                    <Icon size={15} />
                    {label}
                    {id === "evidence" && currentExecution && (
                      <i className="evidence-dot" />
                    )}
                  </button>
                ))}
              </div>
              <span className="simulation-badge">
                <span />
                Simulation
              </span>
            </div>
            {tab === "evidence" && (
              <div className="evidence-view">
                <div className="evidence-heading">
                  <span className="eyebrow">OBSERVE BEFORE YOU CONCLUDE</span>
                  <h3>What changed. And how we know.</h3>
                  <p>
                    These results come from the simulation model. Real lab
                    evidence is shown separately.
                  </p>
                </div>
                {currentExecution ? (
                  <>
                    <div className="evidence-summary">
                      <CheckCheck size={18} />
                      {currentExecution.summary}
                    </div>
                    {currentExecution.evidence.map((item, index) => (
                      <EvidenceRow key={index} item={item} />
                    ))}
                    <div className="execution-steps">
                      {currentExecution.steps.map((step, i) => (
                        <div key={step}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          {step}
                          <Check size={13} />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="canvas-empty">
                    <Terminal size={29} />
                    <strong>Evidence starts with an action.</strong>
                    <p>
                      Run this mission’s action, then inspect its results here.
                    </p>
                  </div>
                )}
                {mission.lab && (
                  <div className="real-lab-invitation">
                    <FlaskConical size={21} />
                    <div>
                      <strong>Take this idea into a real environment.</strong>
                      <p>
                        A short Node.js recipe runs real HTTP checks in an
                        isolated VM.
                      </p>
                    </div>
                    <button className="button secondary small" onClick={runLab}>
                      Verify for real
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {tab === "artifacts" && (
              <div className="artifacts-view">
                <div className="artifact-list">
                  {files.map((file, index) => (
                    <button
                      key={file.name}
                      className={artifactIndex === index ? "selected" : ""}
                      onClick={() => setArtifactIndex(index)}
                    >
                      <Code2 size={13} />
                      {file.name}
                    </button>
                  ))}
                  <button
                    className="icon-button"
                    aria-label="Download current artifact"
                    onClick={() =>
                      saveFile(selectedFile.name, selectedFile.body)
                    }
                  >
                    <Download size={15} />
                  </button>
                </div>
                <div className="artifact-note">
                  Educational excerpts that reflect your system.
                  Deployment-specific configuration still needs real
                  verification.
                </div>
                <pre>
                  <code>{selectedFile.body}</code>
                </pre>
              </div>
            )}
            <div className="request-console">
              <span className="request-label">
                <span className="status-dot" />
                REQUEST EXPLORER
              </span>
              <code>GET /claims/claim-001</code>
              <select
                aria-label="Request identity"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              >
                <option value="customer-a">As the claim owner</option>
                <option value="customer-b">As another customer</option>
                <option value="anonymous">Without a session</option>
              </select>
              <button onClick={sendProbe} className="button secondary small">
                Send
                <Send size={13} />
              </button>
              {probe && (
                <span
                  className={`probe-status ${probe.status === 200 ? "success" : "warning"}`}
                  title={probe.text}
                >
                  HTTP {probe.status}
                  <span>{probe.text}</span>
                </span>
              )}
            </div>
          </section>

          <div className="studio-explore-actions">
            <button
              className="button secondary small"
              onClick={() => setHistory(true)}
              disabled={busy || !ready}
            >
              <History size={14} />
              Checkpoints ({progress.checkpoints.length})
            </button>
            <button
              className="button secondary small"
              onClick={() => run("outage")}
              disabled={busy || !ready || !unlocked}
            >
              <TriangleAlert size={14} />
              Inject a training failure
            </button>
            {progress.state.gitops && (
              <button
                className="button secondary small"
                onClick={() => run("drift")}
                disabled={busy || !ready || !unlocked}
              >
                Introduce drift
              </button>
            )}
            <a
              className="text-link"
              href={mission.reference.url}
              target="_blank"
              rel="noreferrer"
            >
              Official reference
              <ExternalLink size={13} />
            </a>
          </div>
          {runError && (
            <p className="flow-error" role="alert">
              {runError}
            </p>
          )}
          <p className="explore-note">
            Optional experiments change your simulated system. Restore a
            checkpoint to undo an experiment; your earned XP stays with you.
          </p>
        </div>
      </details>
      <div className="guided-save-status">
        <Check size={13} />
        {sync}
        <span>Simulation progress · no account needed</span>
      </div>
      <Dialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={
          sideTab === "mentor"
            ? "Ada · Your engineering guide"
            : "Explore this component"
        }
      >
        <aside className="mentor-panel guided-mentor-panel">
          <div className="mentor-tabs">
            <button
              className={sideTab === "mentor" ? "selected" : ""}
              onClick={() => setSideTab("mentor")}
            >
              <Sparkles size={15} />
              Engineering guide
            </button>
            <button
              className={sideTab === "inspect" ? "selected" : ""}
              onClick={() => setSideTab("inspect")}
            >
              <Network size={15} />
              Inspector
            </button>
          </div>
          {sideTab === "mentor" ? (
            <>
              <div className="mentor-identity">
                <span className="guide-mark" aria-hidden="true">
                  a/
                </span>
                <div>
                  <strong>
                    Ada
                    <span className="online-dot" />
                  </strong>
                  <span>Context, evidence & next steps</span>
                </div>
                <span className="gemini-label">GEMINI</span>
              </div>
              <div className="mentor-conversation">
                <div className="mentor-welcome">
                  <span className="message-label">MISSION GUIDE</span>
                  <p>{mission.concept}</p>
                </div>
                {hints > 0 && (
                  <div className="hint-message">
                    <span>
                      <Lightbulb size={14} />
                      Hint · {hints}/3
                    </span>
                    <p>{mission.hints[hints - 1]}</p>
                    {hints < 3 && (
                      <button
                        onClick={() =>
                          setHintCounts((p) => ({
                            ...p,
                            [mission.id]: hints + 1,
                          }))
                        }
                      >
                        Next hint
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                )}
                {currentAnswer && (
                  <div className="ai-message">
                    <span className="message-label">
                      <Sparkles size={12} /> GEMINI RESPONSE
                      {currentAnswer.cached ? " · SAVED ANSWER" : ""}
                    </span>
                    <p>{currentAnswer.answer}</p>
                    {currentAnswer.hint && (
                      <div className="answer-hint">
                        <Lightbulb size={14} />
                        {currentAnswer.hint}
                      </div>
                    )}
                    {currentAnswer.action && (
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() => run(currentAnswer.action!)}
                      >
                        Apply this step
                        <Play size={13} />
                      </button>
                    )}
                    <a
                      className="saved-answer-link"
                      href={`/answers/${currentAnswer.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open saved answer
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                )}
                {asking && (
                  <div className="thinking">
                    <i />
                    <i />
                    <i />
                    <span>Thinking about your system…</span>
                  </div>
                )}
                {mentorError && (
                  <div className="inline-error" role="alert">
                    {mentorError}
                    {!user && (
                      <Link href="/login">
                        Sign in
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                )}
                <div className="mentor-prompt-suggestions">
                  <span>ASK ABOUT THIS SYSTEM</span>
                  {[
                    "Explain this like I’m new to engineering",
                    "What could go wrong here?",
                  ].map((text) => (
                    <button key={text} onClick={() => setQuestion(text)}>
                      {text}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
              <form className="mentor-input" onSubmit={ask}>
                <label htmlFor="mentor-question" className="sr-only">
                  Ask Ada about your system
                </label>
                <textarea
                  id="mentor-question"
                  value={question}
                  maxLength={1200}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about this system…"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask();
                    }
                  }}
                />
                <div>
                  <span>
                    <ShieldCheck size={12} />
                    Only runs when you ask
                  </span>
                  <button
                    aria-label="Send question to Ada"
                    disabled={asking || !question.trim()}
                  >
                    {asking ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </button>
                </div>
              </form>
              <div className="mentor-budget">
                {currentAnswer?.remaining !== undefined
                  ? `${currentAnswer.remaining} mentor requests left today`
                  : "Up to 8 mentor requests per account / day"}
                <span>Guided hints are always free.</span>
              </div>
            </>
          ) : (
            <div className="inspector-content">
              {inspected ? (
                <>
                  <div className="inspector-label">
                    COMPONENT INSPECTOR
                    <button
                      className="icon-button"
                      aria-label="Clear selected component"
                      onClick={() => setFocus(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <h2>{inspected.title}</h2>
                  <p className="inspector-role">{inspected.role}</p>
                  <div className="inspector-section">
                    <h3>What happens here</h3>
                    <p>{inspected.explanation}</p>
                  </div>
                  <div className="inspector-section">
                    <h3>Its responsibility</h3>
                    <p>{inspected.responsibility}</p>
                  </div>
                  <div className="inspector-section">
                    <h3>Questions worth asking</h3>
                    <p>
                      Who can reach this component? What happens when it fails?
                      What evidence would tell you it is working?
                    </p>
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  <Network size={31} />
                  <h3>Look a little closer.</h3>
                  <p>
                    Select any component on the map to understand its role and
                    the decisions behind it.
                  </p>
                </div>
              )}
              <div className="system-risks">
                <h3>
                  Still worth exploring{" "}
                  <span>{risks(progress.state).length}</span>
                </h3>
                {risks(progress.state).map((risk) => (
                  <div key={risk}>
                    <span />
                    {risk}
                  </div>
                ))}
                {risks(progress.state).length === 0 && (
                  <p>
                    The modelled controls are in place. Real systems still need
                    verification and ongoing review.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </Dialog>
      <Dialog
        open={missionMenu}
        onClose={() => setMissionMenu(false)}
        title="Your mission path"
        wide
      >
        <div className="mission-picker">
          {chapters.map((chapter, index) => (
            <section key={chapter.title}>
              <div className="eyebrow">
                CHAPTER {index + 1} · {chapter.title.toUpperCase()}
              </div>
              {missions
                .filter((m) => m.chapter === index)
                .map((m) => (
                  <button
                    key={m.id}
                    className={mission.id === m.id ? "selected" : ""}
                    disabled={
                      !ready ||
                      !isMissionUnlocked(
                        missions.indexOf(m),
                        progress.completed,
                      )
                    }
                    onClick={() => chooseMission(missions.indexOf(m))}
                  >
                    <span
                      className={`mission-picker-status ${progress.completed.includes(m.id) ? "done" : ""}`}
                    >
                      {progress.completed.includes(m.id) ? (
                        <Check size={14} />
                      ) : (
                        String(missions.indexOf(m) + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{m.title}</strong>
                      <small>
                        {isMissionUnlocked(
                          missions.indexOf(m),
                          progress.completed,
                        )
                          ? m.subtitle
                          : `Complete mission ${(learning.nextMissionIndex ?? 0) + 1} to keep progressing`}
                      </small>
                    </span>
                    {isMissionUnlocked(
                      missions.indexOf(m),
                      progress.completed,
                    ) ? (
                      <ChevronRight size={16} />
                    ) : (
                      <LockKeyhole size={14} />
                    )}
                  </button>
                ))}
            </section>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={history}
        onClose={() => setHistory(false)}
        title="A safe place to return to"
      >
        <p className="dialog-intro">
          Restore your simulated system before a change. Your completed
          discoveries and notebook stay with you.
        </p>
        {progress.checkpoints.length ? (
          progress.checkpoints
            .slice()
            .reverse()
            .map((checkpoint) => (
              <div className="checkpoint-row" key={checkpoint.id}>
                <RotateCcw size={17} />
                <div>
                  <strong>{checkpoint.title}</strong>
                  <small>{new Date(checkpoint.at).toLocaleString()}</small>
                </div>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => {
                    update((p) => ({ ...p, state: checkpoint.state }));
                    setExecution(null);
                    setMissionExecution(null);
                    setStage("build");
                    setRunError("");
                    setProbe(null);
                    setHistory(false);
                    notify(
                      "Checkpoint restored. Your learning record is preserved.",
                    );
                  }}
                >
                  Restore
                </button>
              </div>
            ))
        ) : (
          <div className="canvas-empty">
            <History size={30} />
            <p>Your first action will create a checkpoint.</p>
          </div>
        )}
      </Dialog>
      <Dialog
        open={labOpen}
        onClose={() => setLabOpen(false)}
        title="Real verification, real evidence"
      >
        <div className="lab-modal-intro">
          <FlaskConical size={21} />
          <p>
            A disposable Vercel VM runs a real Node.js HTTP service and checks
            its behaviour using synthetic data. It shuts down after the recipe.
          </p>
        </div>
        {labBusy && (
          <div className="lab-loading">
            <LoaderCircle size={26} className="spin" />
            <strong>Preparing and checking your isolated service…</strong>
            <p>This can take a few seconds. No Gemini call is needed.</p>
          </div>
        )}
        {labError && (
          <div className="inline-error" role="alert">
            {labError}
            {!user && (
              <Link href="/login">
                Sign in to continue
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
        {labResult && (
          <>
            <div className="real-evidence-badge">
              <CheckCheck size={16} />
              VERIFIED IN AN ISOLATED VM
            </div>
            {labResult.results.map((item, index) => (
              <EvidenceRow key={index} item={item} />
            ))}
            <p className="lab-limitations">{labResult.limitations}</p>
            <button
              className="button secondary small"
              onClick={() =>
                saveFile(
                  `opsstudio-lab-${labResult.id}.json`,
                  JSON.stringify(labResult, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              Download evidence
            </button>
          </>
        )}
      </Dialog>
    </div>
  );
}

function EvidenceRow({ item }: { item: Evidence }) {
  return (
    <div className={`evidence-row ${item.status}`}>
      <span>
        {item.status === "pass" ? (
          <Check size={15} />
        ) : (
          <TriangleAlert size={15} />
        )}
      </span>
      <div>
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
    </div>
  );
}

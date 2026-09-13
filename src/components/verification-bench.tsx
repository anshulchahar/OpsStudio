"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Download,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { recipeIds, type RecipeId } from "@/lib/lab-recipes";

const evidenceSchema = z.object({
  id: z.string().uuid(),
  recipe: z.enum(recipeIds),
  mode: z.literal("real-execution"),
  passed: z.boolean(),
  results: z
    .array(
      z.object({
        label: z.string().max(500),
        detail: z.string().max(2000),
        status: z.enum(["pass", "warn", "fail"]),
      }),
    )
    .min(1)
    .max(20),
  limitations: z.string().max(4000),
  remaining: z.number().int().min(0).optional(),
});
type VerificationEvidence = z.infer<typeof evidenceSchema>;

const recipes: {
  id: RecipeId;
  label: string;
  title: string;
  description: string;
  checks: { code: string; text: string }[];
  action: string;
}[] = [
  {
    id: "health",
    label: "SERVICE CONTRACT",
    title: "Does the service respond honestly?",
    description:
      "Start a small HTTP service and check that healthy and missing resources produce the responses you expect.",
    checks: [
      {
        code: "200",
        text: "The health endpoint responds with a healthy state.",
      },
      { code: "404", text: "An unknown route reports a missing resource." },
    ],
    action: "Run the health check",
  },
  {
    id: "authorization",
    label: "OWNERSHIP BOUNDARY",
    title: "Can one customer read another’s claim?",
    description:
      "Reproduce cross-customer access in a synthetic claims service, enforce ownership, and verify who can still read the record.",
    checks: [
      {
        code: "200 → 403",
        text: "Cross-customer access is reproduced, then denied.",
      },
      { code: "200", text: "The legitimate owner keeps access." },
      { code: "401", text: "A request without the test identity is rejected." },
    ],
    action: "Verify claim ownership",
  },
];

function exportEvidence(evidence: VerificationEvidence) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `opsstudio-verification-${evidence.recipe}-${evidence.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VerificationBench() {
  const { user, ready, notify } = useStudio();
  const [busy, setBusy] = useState<RecipeId | null>(null);
  const [results, setResults] = useState<
    Partial<Record<RecipeId, VerificationEvidence>>
  >({});
  const [errors, setErrors] = useState<Partial<Record<RecipeId, string>>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const pending = useRef(false);

  async function run(recipe: RecipeId) {
    if (!ready || !user) {
      notify("Sign in before running a real verification check.");
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusy(recipe);
    setErrors((previous) => ({ ...previous, [recipe]: undefined }));
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipe }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The verification request could not finish.",
        );
      const parsed = evidenceSchema.safeParse(data);
      if (!parsed.success || parsed.data.recipe !== recipe) {
        throw new Error(
          "The runner returned incomplete evidence. No new successful result is claimed.",
        );
      }
      setResults((previous) => ({ ...previous, [recipe]: parsed.data }));
      if (parsed.data.remaining !== undefined)
        setRemaining(parsed.data.remaining);
      notify(
        parsed.data.passed
          ? "Verification evidence is ready."
          : "The verification returned a failed check. Inspect the evidence.",
      );
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        [recipe]:
          error instanceof Error
            ? error.message
            : "Could not load verification evidence. Try again when the runner is available.",
      }));
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="page verification-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE VERIFICATION BENCH</div>
          <h1>
            PUT IT <span>TO THE TEST.</span>
          </h1>
          <p>
            Two fixed checks run actual HTTP requests inside a disposable
            Node.js environment. Inspect the response behavior alongside your
            project rehearsals.
          </p>
        </div>
        <Link href="/notebook" className="button secondary">
          Engineering record <ArrowRight size={16} />
        </Link>
      </div>
      <div className="verification-context">
        <FlaskConical size={22} />
        <div>
          <strong>Real execution · bounded test fixtures</strong>
          <p>
            Each run starts an isolated environment, sends real requests, and
            returns evidence. Synthetic identities are test fixtures. These
            checks do not deploy a project or verify a production identity
            provider.
          </p>
        </div>
        <span>
          {remaining !== null
            ? `${remaining} runs remaining today`
            : "Up to 2 runs per UTC day"}
        </span>
      </div>
      {ready && !user ? (
        <div className="verification-signin">
          <LockKeyhole size={19} />
          <p>
            Sign in to use the isolated runner. You can explore every project
            rehearsal as a guest.
          </p>
          <Link href="/login" className="button primary small">
            Sign in to verify <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
      <div className="verification-recipes">
        {recipes.map((recipe) => {
          const evidence = results[recipe.id];
          const error = errors[recipe.id];
          const isRunning = busy === recipe.id;
          return (
            <article className="verification-recipe" key={recipe.id}>
              <header>
                <span>
                  {recipe.id === "health" ? (
                    <Radio size={22} />
                  ) : (
                    <ShieldCheck size={22} />
                  )}
                </span>
                <div>
                  <small>{recipe.label}</small>
                  <h2>{recipe.title}</h2>
                </div>
              </header>
              <p>{recipe.description}</p>
              <ul className="verification-expectations">
                {recipe.checks.map((check) => (
                  <li key={check.code}>
                    <code>{check.code}</code>
                    <span>{check.text}</span>
                  </li>
                ))}
              </ul>
              <div className="verification-run-action">
                <button
                  className="button primary"
                  onClick={() => run(recipe.id)}
                  disabled={!ready || !user || busy !== null || remaining === 0}
                >
                  {isRunning ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <FlaskConical size={16} />
                  )}
                  {isRunning
                    ? "Verification running…"
                    : evidence
                      ? `Run ${recipe.id === "health" ? "health check" : "ownership check"} again`
                      : recipe.action}
                </button>
                <small>
                  {remaining === 0
                    ? "Your daily allowance is used."
                    : "Uses 1 verification run. No Gemini request."}
                </small>
              </div>
              {isRunning ? (
                <div className="verification-running" role="status">
                  <LoaderCircle size={17} className="spin" />
                  <p>
                    Waiting for the isolated runner. Evidence will appear when
                    it finishes, usually within a minute.
                  </p>
                </div>
              ) : null}
              {error ? (
                <div className="verification-error" role="alert">
                  <CircleAlert size={18} />
                  <div>
                    <strong>This attempt did not finish.</strong>
                    <p>{error}</p>
                    {evidence ? (
                      <small>
                        The evidence below belongs to your previous completed
                        run.
                      </small>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {evidence ? (
                <section
                  className="verification-evidence"
                  aria-label={`${recipe.id} verification evidence`}
                >
                  <header>
                    <strong>
                      {evidence.passed ? "Checks passed" : "A check failed"}
                    </strong>
                    <span>
                      {isRunning || error
                        ? "PREVIOUS COMPLETED RUN"
                        : "REAL HTTP EXECUTION"}
                    </span>
                  </header>
                  {evidence.results.map((item) => (
                    <div
                      className={`verification-evidence-row ${item.status}`}
                      key={item.label}
                    >
                      {item.status === "pass" ? (
                        <Check size={16} />
                      ) : (
                        <CircleAlert size={16} />
                      )}
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                  <p className="verification-limitations">
                    {evidence.limitations}
                  </p>
                  <footer>
                    <span>Run {evidence.id}</span>
                    <button
                      className="button secondary small"
                      onClick={() => exportEvidence(evidence)}
                    >
                      <Download size={14} />
                      Download JSON
                    </button>
                  </footer>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="verification-allowance-note">
        Runs start only when you ask. Account and shared platform allowances
        apply; a reserved attempt can count even if execution fails. Successful
        evidence is saved to your account. Download the JSON before leaving to
        keep a local copy.
      </p>
    </div>
  );
}

import { z } from "zod";
import { PROJECT_CATALOG_VERSION } from "./project-types.ts";
import type {
  Approach,
  Metrics,
  PracticeProject,
  WorkOrder,
} from "./project-types.ts";

const identifier = z.string().min(1).max(64);
const metricsSchema = z.object({
  availability: z.number().finite(), risk: z.number().finite(),
  latency: z.number().finite(), monthlyCost: z.number().finite(),
});
const snapshotSchema = z.object({
  catalogVersion: z.string().min(1).max(80),
  projectName: z.string().min(1).max(180),
  work: z.object({
    id: identifier, title: z.string().min(1).max(240),
    kind: z.enum(["request", "incident", "experiment", "review"]),
    requires: z.array(identifier).max(80), skills: z.array(z.string().max(120)).max(20),
    reference: z.object({ title: z.string().max(240), url: z.string().url().max(2048) }),
  }),
  option: z.object({
    id: identifier, title: z.string().min(1).max(240),
    summary: z.string().max(1600), tradeoff: z.string().max(1600),
    changes: z.array(z.string().max(600)).max(10), effects: metricsSchema.partial(),
    evidence: z.array(z.object({ label: z.string().max(240), detail: z.string().max(2000), status: z.enum(["pass", "warn", "fail"]) })).max(10),
    artifact: z.object({ filename: z.string().max(240), language: z.string().max(40), body: z.string().max(12000) }),
    outcome: z.enum(["shipped", "needs-work"]), learning: z.string().max(1600), recommendation: z.string().max(1600),
  }),
});
export type AppliedDecision = z.infer<typeof snapshotSchema>;
const receiptSchema = z.object({
  id: identifier,
  workId: identifier,
  optionId: identifier,
  at: z.string().datetime({ offset: true }),
  snapshot: snapshotSchema.optional(),
  before: metricsSchema.optional(),
  after: metricsSchema.optional(),
});

export const projectRunSchema = z.object({
  selections: z
    .record(identifier, identifier)
    .refine(
      (value) => Object.keys(value).length <= 80,
      "A project can hold up to 80 changes.",
    )
    .default({}),
  history: z.array(receiptSchema).max(40).default([]),
  activeWorkId: identifier.nullable().default(null),
  applied: z.record(identifier, snapshotSchema).refine((value) => Object.keys(value).length <= 80).default({}),
  initialMetrics: metricsSchema.optional(),
});

export type ProjectRun = z.infer<typeof projectRunSchema>;

export function emptyProjectRun(): ProjectRun {
  return projectRunSchema.parse({});
}

export const projectPortfolioSchema = z
  .object({
    activeProject: identifier.default("cornerstone"),
    runs: z
      .record(identifier, projectRunSchema)
      .refine(
        (value) => Object.keys(value).length <= 16,
        "A portfolio can hold up to 16 projects.",
      )
      .default({}),
  })
  .superRefine((portfolio, context) => {
    const receiptCount = Object.values(portfolio.runs).reduce(
      (total, run) => total + run.history.length,
      0,
    );
    if (receiptCount > 320) {
      context.addIssue({
        code: "custom",
        path: ["runs"],
        message: "A portfolio can hold up to 320 change receipts.",
      });
    }
  })
  .default({ activeProject: "cornerstone", runs: {} });

export type ProjectPortfolio = z.infer<typeof projectPortfolioSchema>;
type Selection = { work: WorkOrder; option: Approach };

export function getAppliedDecision(run: ProjectRun, workId: string) {
  const snapshot = run.applied?.[workId];
  return snapshot?.option.id === run.selections[workId] ? snapshot : undefined;
}

function snapshotWork(snapshot: AppliedDecision, current?: WorkOrder): WorkOrder {
  return {
    from: { name: "Saved record", role: "Archived request" }, brief: "Previously applied work.",
    why: "", affected: [], hints: [], options: [snapshot.option], ...current, ...snapshot.work,
  };
}

/** Resolve dependencies independently of the order saved object keys were written. */
function resolveSelections(project: PracticeProject, run: ProjectRun) {
  const accepted = new Map<string, Selection>();
  const shipped = new Set<string>();
  const definitions = [...project.work];
  for (const [id, snapshot] of Object.entries(run.applied ?? {})) {
    if (!definitions.some((work) => work.id === id) && snapshot.work.id === id) definitions.push(snapshotWork(snapshot));
  }
  let pending = definitions.filter((work) =>
    Object.hasOwn(run.selections, work.id),
  );

  while (pending.length > 0) {
    const next: WorkOrder[] = [];
    let changed = false;
    for (const work of pending) {
      const captured = getAppliedDecision(run, work.id);
      const definition = captured ? snapshotWork(captured, work) : work;
      const option = captured?.option ?? work.options.find(
        (item) => item.id === run.selections[work.id],
      );
      if (!option) continue;
      if (!definition.requires.every((id) => shipped.has(id))) {
        next.push(work);
        continue;
      }
      accepted.set(work.id, { work: definition, option });
      if (option.outcome === "shipped") shipped.add(work.id);
      changed = true;
    }
    if (!changed) break;
    pending = next;
  }

  return { accepted, shipped };
}

function bounded(value: number, min: number, max: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, value)) * factor) / factor;
}

function metricsFrom(
  project: PracticeProject,
  accepted: Map<string, Selection>,
): Metrics {
  const metrics = { ...project.initialMetrics };
  // Sum before clamping so independent decisions remain independent of catalog order.
  for (const { option } of accepted.values()) {
    for (const key of Object.keys(metrics) as (keyof Metrics)[]) {
      const effect = option.effects[key];
      if (effect !== undefined && Number.isFinite(effect))
        metrics[key] += effect;
    }
  }
  return {
    availability: bounded(metrics.availability, 0, 99.99, 2),
    risk: bounded(metrics.risk, 0, 100, 1),
    latency: bounded(metrics.latency, 1, 100_000),
    monthlyCost: bounded(metrics.monthlyCost, 0, 1_000_000, 2),
  };
}

export function deriveProject(project: PracticeProject, run: ProjectRun) {
  const { accepted, shipped } = resolveSelections(project, run);
  const shippedIds = [...new Set([...project.work.map((work) => work.id), ...accepted.keys()])].filter((id) => shipped.has(id));
  const availableWork = project.work.filter((work) =>
    work.requires.every((id) => shipped.has(id)),
  );
  let latest: Selection | null = null;
  for (let index = run.history.length - 1; index >= 0; index -= 1) {
    const receipt = run.history[index];
    const selection = accepted.get(receipt.workId);
    if (selection?.option.id === receipt.optionId) {
      latest = selection;
      break;
    }
  }
  if (!latest) {
    for (const work of project.work) latest = accepted.get(work.id) ?? latest;
  }
  return {
    metrics: metricsFrom({ ...project, initialMetrics: run.initialMetrics ?? project.initialMetrics }, accepted),
    shippedIds,
    availableWork,
    latest,
    accepted: Object.fromEntries(accepted),
  };
}

export function getAvailableWork(project: PracticeProject, run: ProjectRun) {
  return deriveProject(project, run).availableWork;
}

export function getProjectMetrics(project: PracticeProject, run: ProjectRun) {
  return deriveProject(project, run).metrics;
}

export function runProjectChange(
  project: PracticeProject,
  run: ProjectRun,
  workId: string,
  optionId: string,
  receipt: { id: string; at: string },
) {
  const parsedRun = projectRunSchema.parse(run);
  const work = project.work.find((item) => item.id === workId);
  if (!work) throw new Error("This work request is not part of this project.");
  const option = work.options.find((item) => item.id === optionId);
  if (!option)
    throw new Error("Choose an available approach for this request.");

  const before = deriveProject(project, parsedRun);
  if (!before.availableWork.some((item) => item.id === workId)) {
    const missing = work.requires.filter(
      (id) => !before.shippedIds.includes(id),
    );
    const titles = missing.map(
      (id) => project.work.find((item) => item.id === id)?.title ?? id,
    );
    throw new Error(`First ship: ${titles.join(", ")}.`);
  }
  const snapshot = snapshotSchema.parse({
    catalogVersion: PROJECT_CATALOG_VERSION, projectName: project.name,
    work: { id: work.id, title: work.title, kind: work.kind, requires: work.requires, skills: work.skills, reference: work.reference },
    option,
  });
  const historyItem = receiptSchema.parse({ ...receipt, workId, optionId, snapshot, before: before.metrics });
  if (parsedRun.history.some((item) => item.id === historyItem.id)) {
    throw new Error("This change receipt already exists. Start a new change.");
  }

  const candidate: ProjectRun = {
    selections: { ...parsedRun.selections, [workId]: optionId },
    history: [...parsedRun.history, historyItem].slice(-40),
    activeWorkId: workId,
    applied: { ...parsedRun.applied, [workId]: snapshot },
    initialMetrics: parsedRun.initialMetrics ?? { ...project.initialMetrics },
  };
  const { accepted } = resolveSelections(project, candidate);
  // A weakened prerequisite removes dependent configuration, preserving its old receipts.
  const nextRun = projectRunSchema.parse({
    ...candidate,
    selections: Object.fromEntries(
      [...accepted].map(([id, selection]) => [id, selection.option.id]),
    ),
    applied: Object.fromEntries(Object.entries(candidate.applied).filter(([id]) => accepted.has(id))),
  });
  const after = metricsFrom({ ...project, initialMetrics: nextRun.initialMetrics ?? project.initialMetrics }, accepted);
  nextRun.history[nextRun.history.length - 1].after = after;
  return {
    run: nextRun,
    before: before.metrics,
    after,
    work,
    option,
  };
}

export function renderProjectReport(
  project: PracticeProject,
  run: ProjectRun,
): string {
  const { metrics, shippedIds } = deriveProject(project, run);
  const { accepted } = resolveSelections(project, run);
  const lines = [
    `# ${project.name} — engineering record`,
    "",
    project.brief,
    "",
    "These are modeled outcomes in an OpsStudio practice environment, not measurements from a deployed production system.",
    "",
    `Industry: ${project.industry}`,
    `Changes shipped: ${shippedIds.length} / ${project.work.length}`,
    `Modeled availability: ${metrics.availability}%`,
    `Modeled risk: ${metrics.risk} / 100`,
    `Modeled latency: ${metrics.latency} ms`,
    `Modeled monthly cost: €${metrics.monthlyCost.toFixed(2)}`,
    "",
    "## Current decisions",
  ];
  if (accepted.size === 0) lines.push("", "No changes applied yet.");
  for (const [id, selection] of accepted) {
    const { option, work } = selection;
    const captured = getAppliedDecision(run, id);
    lines.push(
      "",
      `### ${work.title}`,
      `Approach: ${option.title} (${option.outcome === "shipped" ? "shipped" : "needs more work"})`,
      captured ? `Captured catalog: ${captured.catalogVersion}` : "Legacy decision: no historical evidence snapshot was recorded; the description below uses the current catalog.",
      option.summary,
      `Tradeoff: ${option.tradeoff}`,
      ...option.evidence.map(
        (item) => `- [${item.status}] ${item.label}: ${item.detail}`,
      ),
      `What this demonstrates: ${option.learning}`,
      `Recommended next improvement: ${option.recommendation}`,
      `Illustrative configuration: ${option.artifact.filename}`,
      `\n\`\`\`${option.artifact.language}\n${option.artifact.body}\n\`\`\``,
    );
  }
  lines.push("", "## Change history", "");
  if (run.history.length === 0) lines.push("No changes recorded yet.");
  for (const receipt of run.history) {
    const currentWork = project.work.find((item) => item.id === receipt.workId);
    const work = receipt.snapshot?.work ?? currentWork;
    const option = receipt.snapshot?.option ?? currentWork?.options.find((item) => item.id === receipt.optionId);
    if (!work || !option) {
      lines.push(`- ${receipt.at} · Archived request ${receipt.workId} / ${receipt.optionId} (legacy receipt without an evidence snapshot)`);
      continue;
    }
    const current = accepted.get(work.id)?.option.id === option.id;
    lines.push(
      `- ${receipt.at} · ${work.title} → ${option.title}${current ? " (current choice)" : " (historical choice)"}`,
    );
    if (receipt.snapshot) lines.push(`  Catalog ${receipt.snapshot.catalogVersion}; ${option.evidence.map((item) => `[${item.status}] ${item.label}: ${item.detail}`).join(" | ")}`);
    if (receipt.before && receipt.after) lines.push(`  Modeled results at the time: availability ${receipt.before.availability}% → ${receipt.after.availability}%; risk ${receipt.before.risk} → ${receipt.after.risk}; latency ${receipt.before.latency} → ${receipt.after.latency} ms; monthly cost €${receipt.before.monthlyCost} → €${receipt.after.monthlyCost}.`);
  }
  return `${lines.join("\n")}\n`;
}

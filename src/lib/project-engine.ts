import { z } from "zod";
import type {
  Approach,
  Metrics,
  PracticeProject,
  WorkOrder,
} from "./project-types.ts";

const identifier = z.string().min(1).max(64);
const receiptSchema = z.object({
  id: identifier,
  workId: identifier,
  optionId: identifier,
  at: z.string().datetime({ offset: true }),
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

/** Resolve dependencies independently of the order saved object keys were written. */
function resolveSelections(project: PracticeProject, run: ProjectRun) {
  const accepted = new Map<string, Selection>();
  const shipped = new Set<string>();
  let pending = project.work.filter((work) =>
    Object.hasOwn(run.selections, work.id),
  );

  while (pending.length > 0) {
    const next: WorkOrder[] = [];
    let changed = false;
    for (const work of pending) {
      const option = work.options.find(
        (item) => item.id === run.selections[work.id],
      );
      if (!option) continue;
      if (!work.requires.every((id) => shipped.has(id))) {
        next.push(work);
        continue;
      }
      accepted.set(work.id, { work, option });
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
  const shippedIds = project.work
    .filter((work) => shipped.has(work.id))
    .map((work) => work.id);
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
    metrics: metricsFrom(project, accepted),
    shippedIds,
    availableWork,
    latest,
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
  const historyItem = receiptSchema.parse({ ...receipt, workId, optionId });
  if (parsedRun.history.some((item) => item.id === historyItem.id)) {
    throw new Error("This change receipt already exists. Start a new change.");
  }

  const candidate: ProjectRun = {
    selections: { ...parsedRun.selections, [workId]: optionId },
    history: [...parsedRun.history, historyItem].slice(-40),
    activeWorkId: workId,
  };
  const { accepted } = resolveSelections(project, candidate);
  // A weakened prerequisite removes dependent configuration, preserving its old receipts.
  const nextRun = projectRunSchema.parse({
    ...candidate,
    selections: Object.fromEntries(
      [...accepted].map(([id, selection]) => [id, selection.option.id]),
    ),
  });
  return {
    run: nextRun,
    before: before.metrics,
    after: metricsFrom(project, accepted),
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
  for (const work of project.work) {
    const selection = accepted.get(work.id);
    if (!selection) continue;
    const { option } = selection;
    lines.push(
      "",
      `### ${work.title}`,
      `Approach: ${option.title} (${option.outcome === "shipped" ? "shipped" : "needs more work"})`,
      option.summary,
      `Tradeoff: ${option.tradeoff}`,
      ...option.evidence.map(
        (item) => `- [${item.status}] ${item.label}: ${item.detail}`,
      ),
      `What this demonstrates: ${option.learning}`,
      `Recommended next improvement: ${option.recommendation}`,
    );
  }
  lines.push("", "## Change history", "");
  if (run.history.length === 0) lines.push("No changes recorded yet.");
  for (const receipt of run.history) {
    const work = project.work.find((item) => item.id === receipt.workId);
    const option = work?.options.find((item) => item.id === receipt.optionId);
    if (!work || !option) continue;
    const current = accepted.get(work.id)?.option.id === option.id;
    lines.push(
      `- ${receipt.at} · ${work.title} → ${option.title}${current ? " (current choice)" : " (historical choice)"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

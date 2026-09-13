import { z } from "zod";
import { emptyProgress, savedProgressSchema, type SavedProgress } from "./engine.ts";
import { deriveProject, emptyProjectRun, type ProjectRun } from "./project-engine.ts";
import { projects } from "./projects.ts";

export const PROGRESS_MAX_BYTES = 2 * 1024 * 1024;
export type SyncConflict = {
  id: string;
  kind: "notes" | "reset" | "decision" | "project" | "legacy";
  title: string;
  path: string[];
  local: unknown;
  remote: unknown;
};
export type DeviceRecord = {
  version: 2;
  principalId: string;
  localEpoch: string;
  revision: number | null;
  base: SavedProgress;
  draft: SavedProgress;
  conflicts: SyncConflict[];
};
const conflictSchema = z.object({
  id: z.string(), kind: z.enum(["notes", "reset", "decision", "project", "legacy"]), title: z.string(),
  path: z.array(z.string()), local: z.unknown(), remote: z.unknown(),
});
export const deviceRecordSchema = z.object({
  version: z.literal(2), principalId: z.string().min(1).max(80), localEpoch: z.string().min(1).max(80).default("initial"), revision: z.number().int().nonnegative().nullable(),
  base: savedProgressSchema, draft: savedProgressSchema, conflicts: z.array(conflictSchema).max(100),
});
export const progressWriteSchema = z.object({
  expectedUserId: z.string().uuid(), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  progress: savedProgressSchema,
}).superRefine((value, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(value.progress)).byteLength > PROGRESS_MAX_BYTES) {
    ctx.addIssue({ code: "custom", path: ["progress"], message: "Export older receipts before saving a record larger than 2 MiB." });
  }
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
export function sameValue(a: unknown, b: unknown) { return canonical(a) === canonical(b); }
export function sameProgress(a: SavedProgress, b: SavedProgress) {
  const { updatedAt: _a, ...left } = a;
  const { updatedAt: _b, ...right } = b;
  void _a; void _b;
  return sameValue(left, right);
}
export function newDeviceRecord(principalId: string, legacy?: SavedProgress): DeviceRecord {
  return {
    version: 2, principalId, localEpoch: "initial", revision: principalId === "guest" ? 0 : null,
    base: structuredClone(emptyProgress), draft: structuredClone(legacy ?? emptyProgress), conflicts: [],
  };
}
export function assertProgressSize(progress: SavedProgress) {
  if (new TextEncoder().encode(JSON.stringify(progress)).byteLength > PROGRESS_MAX_BYTES) {
    throw new Error("This record is too large to sync. Export your record and shorten your notes before continuing.");
  }
}

/** Three-way merge preserves unrelated work; conflicting intent requires a decision. */
export function mergeProgress(base: SavedProgress, local: SavedProgress, remote: SavedProgress): { progress: SavedProgress; conflicts: SyncConflict[] } {
  if (sameProgress(local, remote)) return { progress: structuredClone(remote), conflicts: [] };
  if (sameProgress(base, local)) return { progress: structuredClone(remote), conflicts: [] };
  if (sameProgress(base, remote)) return { progress: structuredClone(local), conflicts: [] };
  const conflicts: SyncConflict[] = [];
  const conflict = (kind: SyncConflict["kind"], path: string[], title: string, left: unknown, right: unknown) => {
    conflicts.push({ id: path.join("/"), kind, path, title, local: structuredClone(left), remote: structuredClone(right) });
    return structuredClone(left);
  };
  if (local.resetId !== base.resetId || remote.resetId !== base.resetId) {
    if (local.resetId !== remote.resetId) {
      conflict("reset", ["reset"], "A reset and other saved work overlap", local, remote);
      return { progress: structuredClone(local), conflicts };
    }
  }
  function atom<T>(previous: T, left: T, right: T, path: string[], title: string, kind: SyncConflict["kind"]): T {
    if (sameValue(left, right) || sameValue(previous, right)) return structuredClone(left);
    if (sameValue(previous, left)) return structuredClone(right);
    return conflict(kind, path, title, left, right) as T;
  }
  function union<T extends { id: string }>(left: T[], right: T[], limit: number): T[] {
    return [...new Map([...right, ...left].map((item) => [item.id, item])).values()].slice(-limit);
  }
  const merged = structuredClone(remote);
  merged.notes = atom(base.notes, local.notes, remote.notes, ["notes"], "Your notes were edited in two places", "notes");
  for (const key of Object.keys(base.state) as (keyof SavedProgress["state"])[]) {
    (merged.state[key] as boolean | number) = atom(base.state[key], local.state[key], remote.state[key], ["state", key], "Earlier Northstar state changed in two places", "legacy");
  }
  merged.completed = [...new Set([...remote.completed, ...local.completed])].slice(-30);
  merged.checkpoints = union(local.checkpoints, remote.checkpoints, 30);
  merged.activeMission = local.activeMission !== base.activeMission ? local.activeMission : remote.activeMission;
  merged.portfolio.activeProject = local.portfolio.activeProject !== base.portfolio.activeProject ? local.portfolio.activeProject : remote.portfolio.activeProject;
  merged.portfolio.runs = {};
  for (const projectId of new Set([...Object.keys(base.portfolio.runs), ...Object.keys(local.portfolio.runs), ...Object.keys(remote.portfolio.runs)])) {
    const original = base.portfolio.runs[projectId] ?? emptyProjectRun();
    const left = local.portfolio.runs[projectId] ?? emptyProjectRun();
    const right = remote.portfolio.runs[projectId] ?? emptyProjectRun();
    const run: ProjectRun = { ...structuredClone(right), selections: {}, applied: {} };
    const decision = (source: ProjectRun, id: string) => source.selections[id] ? { optionId: source.selections[id], snapshot: source.applied[id] } : undefined;
    for (const workId of new Set([...Object.keys(original.selections), ...Object.keys(left.selections), ...Object.keys(right.selections)])) {
      const title = projects.find((project) => project.id === projectId)?.work.find((work) => work.id === workId)?.title ?? workId;
      const chosen = atom(decision(original, workId), decision(left, workId), decision(right, workId), ["decision", projectId, workId], `Two approaches were saved for “${title}”`, "decision");
      if (chosen) {
        run.selections[workId] = chosen.optionId;
        if (chosen.snapshot) run.applied[workId] = chosen.snapshot;
      }
    }
    run.history = union(left.history, right.history, 40);
    run.activeWorkId = left.activeWorkId !== original.activeWorkId ? left.activeWorkId : right.activeWorkId;
    run.initialMetrics = right.initialMetrics ?? left.initialMetrics;
    const project = projects.find((item) => item.id === projectId);
    const accepted = project ? deriveProject(project, run).accepted : null;
    const dependencyConflict = accepted && Object.keys(run.selections).some((id) => !accepted[id] &&
      (deriveProject(project!, left).accepted[id] || deriveProject(project!, right).accepted[id]));
    const baselineConflict = left.initialMetrics && right.initialMetrics && !sameValue(left.initialMetrics, right.initialMetrics);
    if (dependencyConflict || baselineConflict) {
      // A prerequisite regression and a newly applied dependent change are one
      // engineering decision. Picking isolated fields would create an invalid system.
      for (let index = conflicts.length - 1; index >= 0; index--) if (conflicts[index].path[1] === projectId) conflicts.splice(index, 1);
      merged.portfolio.runs[projectId] = conflict("project", ["project", projectId], `Overlapping changes need a consistent configuration for ${project?.name ?? projectId}`, { ...left, history: run.history }, { ...right, history: run.history }) as ProjectRun;
    } else merged.portfolio.runs[projectId] = run;
  }
  merged.updatedAt = new Date().toISOString();
  return { progress: savedProgressSchema.parse(merged), conflicts };
}

function conflictValue(progress: SavedProgress, conflict: SyncConflict): unknown {
  const [head, projectId, workId] = conflict.path;
  if (head === "reset") return progress;
  if (head === "notes") return progress.notes;
  if (head === "state") return progress.state[projectId as keyof SavedProgress["state"]];
  if (head === "project") return progress.portfolio.runs[projectId];
  const run = progress.portfolio.runs[projectId];
  return run?.selections[workId] ? { optionId: run.selections[workId], snapshot: run.applied[workId] } : undefined;
}

export function keepConflicts(existing: SyncConflict[], incoming: SyncConflict[], draft: SavedProgress) {
  // An unrelated fetch must not replace an unresolved alternative saved by another tab.
  const combined = new Map(existing.map((item) => [item.id, { ...item, local: conflictValue(draft, item) }]));
  for (const item of incoming) combined.set(item.id, item);
  return [...combined.values()].filter((item) => !sameValue(item.local, item.remote));
}

export function integrateRemote(record: DeviceRecord, progress: SavedProgress, revision: number): DeviceRecord {
  if (record.revision !== null && revision < record.revision) return record;
  const result = mergeProgress(record.base, record.draft, progress);
  return {
    ...record, revision, base: structuredClone(progress), draft: result.progress,
    conflicts: keepConflicts(record.conflicts, result.conflicts, result.progress),
  };
}

export function integrateLocal(record: DeviceRecord, base: SavedProgress, proposed: SavedProgress): DeviceRecord {
  const result = mergeProgress(base, proposed, record.draft);
  assertProgressSize(result.progress);
  return { ...record, draft: result.progress, conflicts: keepConflicts(record.conflicts, result.conflicts, result.progress) };
}

/** Acknowledging our own write must retain edits made while it was in flight. */
export function acknowledgeRemote(record: DeviceRecord, sent: SavedProgress, progress: SavedProgress, revision: number): DeviceRecord {
  if (record.revision !== null && revision < record.revision) return record;
  const result = mergeProgress(sent, record.draft, progress);
  return { ...record, revision, base: structuredClone(progress), draft: result.progress,
    conflicts: keepConflicts(record.conflicts, result.conflicts, result.progress) };
}

export function resolveSyncConflict(record: DeviceRecord, id: string, choice: "local" | "remote" | "both"): DeviceRecord {
  const item = record.conflicts.find((entry) => entry.id === id);
  if (!item) return record;
  const draft = structuredClone(record.draft);
  let selected = choice === "remote" ? item.remote : item.local;
  if (choice === "both" && item.kind === "notes") selected = `${item.local ?? ""}\n\n— Notes from the other device —\n\n${item.remote ?? ""}`;
  if (item.kind === "reset") {
    const checked = savedProgressSchema.parse(selected);
    assertProgressSize(checked);
    return { ...record, draft: checked, conflicts: record.conflicts.filter((entry) => entry.id !== id) };
  }
  if (item.kind === "notes") draft.notes = selected as string;
  else if (item.kind === "project") draft.portfolio.runs[item.path[1]] = selected as ProjectRun;
  else if (item.kind === "legacy") (draft.state[item.path[1] as keyof SavedProgress["state"]] as unknown) = selected;
  else {
    const [, projectId, workId] = item.path;
    const run = draft.portfolio.runs[projectId] ?? emptyProjectRun();
    const value = selected as { optionId: string; snapshot?: ProjectRun["applied"][string] } | undefined;
    if (value) {
      run.selections[workId] = value.optionId;
      if (value.snapshot) run.applied[workId] = value.snapshot;
      else delete run.applied[workId];
    } else { delete run.selections[workId]; delete run.applied[workId]; }
    draft.portfolio.runs[projectId] = run;
  }
  const checked = savedProgressSchema.parse(draft);
  assertProgressSize(checked);
  return { ...record, draft: checked, conflicts: record.conflicts.filter((entry) => entry.id !== id) };
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyProgress, savedProgressSchema, type SavedProgress } from "../src/lib/engine.ts";
import { deriveProject, emptyProjectRun, runProjectChange, renderProjectReport } from "../src/lib/project-engine.ts";
import { PROJECT_CATALOG_VERSION, type PracticeProject } from "../src/lib/project-types.ts";
import { projects } from "../src/lib/projects.ts";
import { acknowledgeRemote, assertProgressSize, integrateLocal, integrateRemote, mergeProgress, newDeviceRecord, resolveSyncConflict, sameProgress, PROGRESS_MAX_BYTES } from "../src/lib/progress-sync.ts";

const at = "2026-09-13T10:00:00.000Z";
let sequence = 0;
const empty = () => structuredClone(emptyProgress);
function apply(progress: SavedProgress, project: PracticeProject, workId?: string, optionId?: string) {
  const next = structuredClone(progress);
  const run = next.portfolio.runs[project.id] ?? emptyProjectRun();
  const work = workId ? project.work.find((item) => item.id === workId)! : deriveProject(project, run).availableWork[0];
  const option = optionId ? work.options.find((item) => item.id === optionId)! : work.options.find((item) => item.outcome === "shipped")!;
  next.portfolio.runs[project.id] = runProjectChange(project, run, work.id, option.id, { id: `receipt-${sequence++}`, at }).run;
  return next;
}
function synced(base = empty()) { return { ...newDeviceRecord("account-a"), base, draft: structuredClone(base), revision: 4 }; }

describe("revision-based progress reconciliation", () => {
  it("merges independent projects from stale devices without choosing a timestamp winner", () => {
    const base = empty();
    const left = apply(base, projects[0]); left.updatedAt = "2099-01-01T00:00:00.000Z";
    const right = apply(base, projects[1]); right.updatedAt = "2000-01-01T00:00:00.000Z";
    const result = mergeProgress(base, left, right);
    assert.deepEqual(Object.keys(result.progress.portfolio.runs).sort(), [projects[0].id, projects[1].id].sort());
    assert.equal(result.conflicts.length, 0);
    assert.deepEqual(result.progress.portfolio.runs[projects[0].id], left.portfolio.runs[projects[0].id]);
    assert.deepEqual(result.progress.portfolio.runs[projects[1].id], right.portfolio.runs[projects[1].id]);
  });
  it("uses server revisions to ignore out-of-order responses even with future client clocks", () => {
    const current = { ...synced(apply(empty(), projects[0])), revision: 12 };
    const obsolete = apply(empty(), projects[1]); obsolete.updatedAt = "2099-01-01T00:00:00.000Z";
    assert.equal(integrateRemote(current, obsolete, 11), current);
    assert.equal(acknowledgeRemote(current, empty(), obsolete, 11), current);
  });
  it("reconciles a device's first cloud fetch before its offline draft can be saved", () => {
    const record = newDeviceRecord("account-a", apply(empty(), projects[0]));
    assert.equal(record.revision, null);
    const result = integrateRemote(record, apply(empty(), projects[1]), 7);
    assert.equal(result.revision, 7);
    assert.equal(Object.keys(result.draft.portfolio.runs).length, 2);
    assert.equal(result.conflicts.length, 0);
    assert.equal(Object.keys(newDeviceRecord("another-account").draft.portfolio.runs).length, 0);
  });
  it("merges independent decisions in one project and unions their immutable receipts", () => {
    const project = projects[0];
    const jobs = deriveProject(project, emptyProjectRun()).availableWork;
    assert.ok(jobs.length >= 2);
    const base = empty(), left = apply(base, project, jobs[0].id), right = apply(base, project, jobs[1].id);
    const result = mergeProgress(base, left, right);
    assert.equal(result.conflicts.length, 0);
    assert.equal(Object.keys(result.progress.portfolio.runs[project.id].selections).length, 2);
    assert.equal(result.progress.portfolio.runs[project.id].history.length, 2);
  });
  it("keeps conflicting notes recoverable through unrelated edits and repeated cloud reads", () => {
    const base = empty(); base.notes = "original";
    const local = { ...base, notes: "device draft" }, remote = { ...base, notes: "other device" };
    let record = integrateRemote({ ...synced(base), draft: local }, remote, 5);
    assert.equal(record.conflicts[0].kind, "notes");
    const unrelated = apply(record.draft, projects[0]);
    record = integrateLocal(record, record.draft, unrelated);
    record = integrateRemote(record, remote, 5);
    assert.equal(record.conflicts[0].local, "device draft");
    assert.equal(record.conflicts[0].remote, "other device");
    for (const [choice, expected] of [["local", "device draft"], ["remote", "other device"]] as const) {
      const resolved = resolveSyncConflict(record, "notes", choice);
      assert.equal(resolved.draft.notes, expected);
      assert.equal(resolved.conflicts.length, 0);
      assert.ok(resolved.draft.portfolio.runs[projects[0].id]);
    }
    const combined = resolveSyncConflict(record, "notes", "both");
    assert.match(combined.draft.notes, /device draft[\s\S]*other device/);
  });
  it("does not turn an unresolved cross-tab alternative into the old server baseline", () => {
    const base = empty(); base.notes = "original";
    let record = integrateLocal({ ...synced(base), draft: { ...base, notes: "tab A" } }, base, { ...base, notes: "tab B" });
    record = integrateRemote(record, base, 4);
    assert.equal(record.conflicts[0].local, "tab B");
    assert.equal(record.conflicts[0].remote, "tab A");
  });
  it("rejects combining notes beyond the documented limit without mutating either saved copy", () => {
    const record = integrateRemote({ ...synced(), draft: { ...empty(), notes: "a".repeat(12000) } }, { ...empty(), notes: "b".repeat(12000) }, 5);
    assert.throws(() => resolveSyncConflict(record, "notes", "both"));
    assert.equal(record.conflicts.length, 1);
    assert.equal(record.draft.notes.length, 12000);
  });
  it("treats resets and concurrent new work as explicit conflicts in either direction", () => {
    const base = apply(empty(), projects[0]);
    const reset = { ...empty(), resetId: "reset-123" }, more = apply(base, projects[1]);
    for (const [local, remote] of [[reset, more], [more, reset]]) {
      const result = mergeProgress(base, local, remote);
      assert.equal(result.conflicts[0].kind, "reset");
      const record = { ...synced(base), draft: result.progress, conflicts: result.conflicts };
      assert.ok(sameProgress(resolveSyncConflict(record, "reset", "local").draft, local));
      assert.ok(sameProgress(resolveSyncConflict(record, "reset", "remote").draft, remote));
    }
  });
  it("pairs divergent approach selections with the exact matching evidence snapshot", () => {
    const project = projects[0], work = deriveProject(project, emptyProjectRun()).availableWork[0];
    const base = empty(), local = apply(base, project, work.id, work.options[0].id), remote = apply(base, project, work.id, work.options[1].id);
    const result = mergeProgress(base, local, remote);
    assert.equal(result.conflicts.length, 1);
    const record = { ...synced(base), draft: result.progress, conflicts: result.conflicts };
    const chosen = resolveSyncConflict(record, result.conflicts[0].id, "remote").draft.portfolio.runs[project.id];
    assert.equal(chosen.selections[work.id], work.options[1].id);
    assert.equal(chosen.applied[work.id].option.id, work.options[1].id);
    assert.equal(chosen.history.length, 2);
  });
  it("requires a coherent project choice when another device weakens a prerequisite", () => {
    const project = projects.find((item) => item.work.some((work) => work.options.some((option) => option.outcome === "needs-work") && item.work.some((dependent) => dependent.requires.includes(work.id))))!;
    const predecessor = project.work.find((work) => work.options.some((option) => option.outcome === "needs-work") && project.work.some((dependent) => dependent.requires.includes(work.id)))!;
    const dependent = project.work.find((work) => work.requires.includes(predecessor.id))!;
    let base = empty();
    function prerequisite(id: string) {
      const work = project.work.find((item) => item.id === id)!;
      for (const required of work.requires) prerequisite(required);
      if (!base.portfolio.runs[project.id]?.selections[id]) base = apply(base, project, id);
    }
    for (const required of dependent.requires) prerequisite(required);
    const local = apply(base, project, predecessor.id, predecessor.options.find((option) => option.outcome === "needs-work")!.id);
    const remote = apply(base, project, dependent.id);
    const merged = mergeProgress(base, local, remote);
    assert.equal(merged.conflicts.length, 1);
    assert.equal(merged.conflicts[0].kind, "project");
    const resolved = resolveSyncConflict({ ...synced(base), draft: merged.progress, conflicts: merged.conflicts }, merged.conflicts[0].id, "remote");
    assert.ok(deriveProject(project, resolved.draft.portfolio.runs[project.id]).shippedIds.includes(dependent.id));
  });
  it("acknowledges an in-flight save without confusing subsequent typing with another device", () => {
    const sent = { ...empty(), notes: "sent" };
    const record = { ...synced(), draft: { ...sent, notes: "typed while saving" } };
    const result = acknowledgeRemote(record, sent, { ...sent, updatedAt: "2026-09-13T11:00:00.000Z" }, 5);
    assert.equal(result.draft.notes, "typed while saving");
    assert.equal(result.base.notes, "sent");
    assert.equal(result.conflicts.length, 0);
  });
});

describe("immutable applied evidence", () => {
  it("retains evidence, artifact, effects, and baseline after catalog revisions or removal", () => {
    const project = structuredClone(projects[0]);
    const progress = apply(empty(), project), run = progress.portfolio.runs[project.id];
    const id = Object.keys(run.selections)[0], before = deriveProject(project, run);
    const snapshot = structuredClone(run.applied[id]);
    const receipt = structuredClone(run.history[0]);
    const work = project.work.find((item) => item.id === id)!;
    work.options[0].effects.monthlyCost = 9999;
    work.options[0].evidence[0].detail = "New editorial evidence";
    work.options[0].artifact.body = "Changed illustrative config";
    project.initialMetrics.monthlyCost = 8000;
    assert.deepEqual(deriveProject(project, run).metrics, before.metrics);
    assert.deepEqual(run.applied[id], snapshot);
    assert.equal(snapshot.catalogVersion, PROJECT_CATALOG_VERSION);
    assert.deepEqual(receipt.before, projects[0].initialMetrics);
    assert.deepEqual(receipt.after, before.metrics);
    project.work = project.work.filter((item) => item.id !== id);
    assert.ok(deriveProject(project, run).shippedIds.includes(id));
    const report = renderProjectReport(project, run);
    assert.ok(report.includes(snapshot.option.evidence[0].detail));
    assert.ok(report.includes(snapshot.option.artifact.body));
    assert.ok(!report.includes("New editorial evidence"));
  });
  it("keeps current applied evidence after its receipt ages out of the history window", () => {
    const project = projects[0], initial = deriveProject(project, emptyProjectRun()).availableWork;
    let progress = apply(empty(), project, initial[0].id);
    progress = apply(progress, project, initial[1].id);
    const snapshot = structuredClone(progress.portfolio.runs[project.id].applied[initial[1].id]);
    for (let index = 0; index < 45; index++) progress = apply(progress, project, initial[0].id);
    const run = progress.portfolio.runs[project.id];
    assert.equal(run.history.length, 40);
    assert.ok(run.history.every((receipt) => receipt.workId !== initial[1].id));
    assert.deepEqual(run.applied[initial[1].id], snapshot);
    assert.equal(deriveProject(project, run).accepted[initial[1].id].option.title, snapshot.option.title);
  });
  it("fits eight fully authored histories plus maximum multilingual notes in the new payload cap", () => {
    let progress = empty();
    for (const project of projects) {
      for (let index = 0; index < project.work.length; index++) {
        const run = progress.portfolio.runs[project.id] ?? emptyProjectRun();
        const job = deriveProject(project, run).availableWork.find((item) => !run.selections[item.id]);
        assert.ok(job);
        progress = apply(progress, project, job.id);
      }
      for (let index = 8; index < 40; index++) progress = apply(progress, project);
    }
    progress.notes = "界".repeat(20000);
    const bytes = new TextEncoder().encode(JSON.stringify(progress)).byteLength;
    assert.ok(bytes < PROGRESS_MAX_BYTES, `Complete authored portfolio is ${bytes} bytes`);
    assertProgressSize(savedProgressSchema.parse(progress));
    assert.equal(Object.values(progress.portfolio.runs).reduce((total, run) => total + run.history.length, 0), 320);
  });
});

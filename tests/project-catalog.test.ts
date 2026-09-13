import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveProject,
  emptyProjectRun,
  projectPortfolioSchema,
  runProjectChange,
} from "../src/lib/project-engine.ts";
import type { ProjectRun } from "../src/lib/project-engine.ts";
import { projects } from "../src/lib/projects.ts";
import type {
  Metrics,
  PracticeProject,
  WorkOrder,
} from "../src/lib/project-types.ts";

let receiptNumber = 0;
const at = "2026-09-13T14:00:00.000Z";
const receipt = () => ({ id: `catalog-${++receiptNumber}`, at });

function assertMetrics(metrics: Metrics, context: string) {
  for (const [key, value] of Object.entries(metrics)) {
    assert.ok(Number.isFinite(value), `${context}: ${key} must be finite`);
  }
  assert.ok(
    metrics.availability >= 0 && metrics.availability <= 100,
    `${context}: availability is a percentage`,
  );
  assert.ok(
    metrics.risk >= 0 && metrics.risk <= 100,
    `${context}: risk stays on its declared scale`,
  );
  assert.ok(metrics.latency > 0, `${context}: latency remains positive`);
  assert.ok(
    metrics.monthlyCost >= 0,
    `${context}: cost cannot become negative`,
  );
}

function assertAuthored(text: string, context: string) {
  assert.ok(text.trim(), `${context}: authored text is required`);
  assert.doesNotMatch(
    text,
    /\b(?:TODO|TBD|lorem ipsum|coming soon)\b/i,
    `${context}: placeholders are not a playable scenario`,
  );
}

function ancestors(
  project: PracticeProject,
  workId: string,
  trail = new Set<string>(),
): Set<string> {
  assert.ok(
    !trail.has(workId),
    `${project.id}: cyclic dependency at ${workId}`,
  );
  const work = project.work.find((item) => item.id === workId);
  assert.ok(work, `${project.id}: unknown dependency ${workId}`);
  const nextTrail = new Set(trail).add(workId);
  const result = new Set<string>();
  for (const parentId of work.requires) {
    result.add(parentId);
    for (const id of ancestors(project, parentId, nextTrail)) result.add(id);
  }
  return result;
}

function shipSet(project: PracticeProject, requested: Set<string>): ProjectRun {
  let run = emptyProjectRun();
  const remaining = new Set(requested);
  while (remaining.size > 0) {
    const available = deriveProject(project, run).availableWork.find((work) =>
      remaining.has(work.id),
    );
    assert.ok(
      available,
      `${project.id}: every requested change must be reachable through shipped prerequisites`,
    );
    const option = available.options.find((item) => item.outcome === "shipped");
    assert.ok(
      option,
      `${available.id}: at least one viable implementation is required`,
    );
    run = runProjectChange(
      project,
      run,
      available.id,
      option.id,
      receipt(),
    ).run;
    remaining.delete(available.id);
  }
  return run;
}

function baselineFor(project: PracticeProject, work: WorkOrder) {
  return shipSet(project, ancestors(project, work.id));
}

describe("authored project catalog", () => {
  it("keeps the extensive multi-industry portfolio present and identifiers unambiguous", () => {
    assert.ok(
      projects.length >= 8,
      "The released portfolio contains at least eight projects.",
    );
    assert.ok(
      projects.reduce((sum, project) => sum + project.work.length, 0) >= 64,
      "The released portfolio contains at least 64 work requests.",
    );
    assert.ok(
      new Set(projects.map((project) => project.industry)).size >= 6,
      "Projects span distinct industries.",
    );
    assert.deepEqual(
      new Set(projects.map((project) => project.stage)),
      new Set(["First steps", "Shipping", "On call", "Systems design"]),
    );
    const projectIds = new Set<string>();
    for (const project of projects) {
      assert.ok(
        !projectIds.has(project.id),
        `Duplicate project: ${project.id}`,
      );
      projectIds.add(project.id);
      const workIds = new Set<string>();
      for (const work of project.work) {
        assert.ok(
          !workIds.has(work.id),
          `${project.id}: duplicate work request ${work.id}`,
        );
        workIds.add(work.id);
        const optionIds = new Set<string>();
        for (const option of work.options) {
          assert.ok(
            !optionIds.has(option.id),
            `${work.id}: duplicate approach ${option.id}`,
          );
          optionIds.add(option.id);
        }
      }
    }
  });

  it("has valid system maps and branching, acyclic work dependencies", () => {
    for (const project of projects) {
      const componentIds = new Set(
        project.components.map((component) => component.id),
      );
      assert.equal(
        componentIds.size,
        project.components.length,
        `${project.id}: component IDs must be unique`,
      );
      assert.ok(
        componentIds.size >= 4,
        `${project.id}: a project needs a meaningful system map`,
      );
      for (const connection of project.connections) {
        assert.ok(
          componentIds.has(connection.from),
          `${project.id}: unknown connection source ${connection.from}`,
        );
        assert.ok(
          componentIds.has(connection.to),
          `${project.id}: unknown connection destination ${connection.to}`,
        );
        assertAuthored(connection.label, `${project.id}: connection label`);
      }
      const initial = project.work.filter((work) => work.requires.length === 0);
      assert.ok(
        initial.length >= 2,
        `${project.id}: learners need independent starting requests`,
      );
      assert.ok(
        initial.length < project.work.length,
        `${project.id}: later work should reflect engineering dependencies`,
      );
      for (const work of project.work) {
        assert.equal(
          new Set(work.requires).size,
          work.requires.length,
          `${work.id}: duplicate prerequisites`,
        );
        assert.ok(
          work.affected.length > 0,
          `${work.id}: identify the system affected by the change`,
        );
        for (const id of work.affected)
          assert.ok(
            componentIds.has(id),
            `${work.id}: unknown affected component ${id}`,
          );
        ancestors(project, work.id);
      }
    }
  });

  it("provides substantive choices, evidence, artifacts, skills, and source references for every request", () => {
    for (const project of projects) {
      assertMetrics(project.initialMetrics, `${project.id}: initial state`);
      for (const field of [
        project.name,
        project.industry,
        project.tagline,
        project.description,
        project.brief,
        project.target,
      ]) {
        assertAuthored(field, project.id);
      }
      for (const work of project.work) {
        for (const field of [
          work.title,
          work.brief,
          work.why,
          work.from.name,
          work.from.role,
        ])
          assertAuthored(field, work.id);
        assert.ok(
          work.skills.length >= 2,
          `${work.id}: name the engineering skills being exercised`,
        );
        assert.ok(
          work.hints.length >= 2,
          `${work.id}: provide useful progressive hints`,
        );
        for (const hint of work.hints) assertAuthored(hint, `${work.id}: hint`);
        for (const skill of work.skills)
          assertAuthored(skill, `${work.id}: skill`);
        const reference = new URL(work.reference.url);
        assert.equal(
          reference.protocol,
          "https:",
          `${work.id}: use a secure reference URL`,
        );
        assert.ok(
          !reference.hostname.endsWith(".example") &&
            reference.hostname !== "example.com",
          `${work.id}: link an actual reference`,
        );
        assertAuthored(work.reference.title, `${work.id}: reference title`);
        assert.ok(
          work.options.length >= 2,
          `${work.id}: offer an implementation tradeoff`,
        );
        assert.ok(
          work.options.some((option) => option.outcome === "shipped"),
          `${work.id}: include a viable path`,
        );
        assert.equal(
          new Set(work.options.map((option) => option.summary)).size,
          work.options.length,
          `${work.id}: approaches need distinct implementations`,
        );
        assert.equal(
          new Set(work.options.map((option) => option.artifact.body)).size,
          work.options.length,
          `${work.id}: artifacts must reflect the selected approach`,
        );
        for (const option of work.options) {
          for (const field of [
            option.title,
            option.summary,
            option.tradeoff,
            option.learning,
            option.recommendation,
          ])
            assertAuthored(field, option.id);
          assert.ok(
            option.changes.length >= 3,
            `${option.id}: show the concrete changes being applied`,
          );
          for (const change of option.changes)
            assertAuthored(change, `${option.id}: change`);
          assert.ok(
            Object.keys(option.effects).length > 0,
            `${option.id}: model a consequence`,
          );
          for (const [key, value] of Object.entries(option.effects)) {
            assert.ok(
              Object.hasOwn(project.initialMetrics, key),
              `${option.id}: unknown metric ${key}`,
            );
            assert.ok(
              Number.isFinite(value),
              `${option.id}: finite metric delta required`,
            );
          }
          assert.ok(
            option.evidence.length >= 2,
            `${option.id}: provide verification and consequences`,
          );
          for (const evidence of option.evidence) {
            assertAuthored(evidence.label, `${option.id}: evidence label`);
            assertAuthored(evidence.detail, `${option.id}: evidence detail`);
          }
          if (option.outcome === "needs-work") {
            assert.ok(
              option.evidence.some((evidence) => evidence.status === "fail"),
              `${option.id}: explain why verification failed`,
            );
          } else {
            assert.ok(
              option.evidence.some((evidence) => evidence.status === "pass"),
              `${option.id}: show what was verified`,
            );
            assert.ok(
              !option.evidence.some((evidence) => evidence.status === "fail"),
              `${option.id}: failed evidence cannot be called shipped`,
            );
          }
          assertAuthored(
            option.artifact.filename,
            `${option.id}: artifact filename`,
          );
          assertAuthored(
            option.artifact.language,
            `${option.id}: artifact language`,
          );
          assertAuthored(
            option.artifact.body,
            `${option.id}: artifact content`,
          );
          if (option.artifact.language === "json") {
            assert.doesNotThrow(
              () => JSON.parse(option.artifact.body),
              `${option.id}: JSON artifacts should parse`,
            );
          }
        }
      }
    }
  });

  it("can complete every project through the real acceptance engine", () => {
    for (const project of projects) {
      const snapshot = structuredClone(project);
      const run = shipSet(
        project,
        new Set(project.work.map((work) => work.id)),
      );
      const derived = deriveProject(project, run);
      assert.deepEqual(
        new Set(derived.shippedIds),
        new Set(project.work.map((work) => work.id)),
        `${project.id}: complete portfolio state`,
      );
      assert.equal(
        Object.keys(run.selections).length,
        project.work.length,
        `${project.id}: each request keeps one current choice`,
      );
      assertMetrics(derived.metrics, `${project.id}: fully shipped`);
      assert.deepEqual(
        project,
        snapshot,
        `${project.id}: running a project must not mutate its authored baseline`,
      );
    }
  });

  it("accepts every viable approach at a reachable baseline without stacking replay effects", () => {
    for (const project of projects) {
      for (const work of project.work) {
        const baseline = baselineFor(project, work);
        const savedBaseline = structuredClone(baseline);
        for (const option of work.options.filter(
          (item) => item.outcome === "shipped",
        )) {
          const result = runProjectChange(
            project,
            baseline,
            work.id,
            option.id,
            receipt(),
          );
          const derived = deriveProject(project, result.run);
          assert.ok(
            derived.shippedIds.includes(work.id),
            `${option.id}: viable approach ships its request`,
          );
          assert.ok(
            work.requires.every((id) => derived.shippedIds.includes(id)),
            `${option.id}: required changes remain shipped`,
          );
          assert.equal(result.run.selections[work.id], option.id);
          assertMetrics(result.after, option.id);
          const replay = runProjectChange(
            project,
            result.run,
            work.id,
            option.id,
            receipt(),
          );
          assert.deepEqual(
            replay.after,
            result.after,
            `${option.id}: replay replaces rather than adds metric effects`,
          );
          assert.equal(
            deriveProject(project, replay.run).shippedIds.length,
            derived.shippedIds.length,
            `${option.id}: replay does not award duplicate progress`,
          );
          assert.deepEqual(
            baseline,
            savedBaseline,
            `${option.id}: alternative trials share an unchanged baseline`,
          );
        }
      }
    }
  });

  it("keeps insufficient approaches unshipped and invalidates dependent configurations after regression", () => {
    let adverseApproaches = 0;
    let testedDependency = false;
    for (const project of projects) {
      for (const work of project.work) {
        for (const option of work.options.filter(
          (item) => item.outcome === "needs-work",
        )) {
          adverseApproaches += 1;
          const result = runProjectChange(
            project,
            baselineFor(project, work),
            work.id,
            option.id,
            receipt(),
          );
          assertMetrics(result.after, `${option.id}: insufficient approach`);
          assert.ok(
            !deriveProject(project, result.run).shippedIds.includes(work.id),
            `${option.id}: cannot pass verification`,
          );
          const dependents = project.work.filter((item) =>
            ancestors(project, item.id).has(work.id),
          );
          for (const dependent of dependents) {
            testedDependency = true;
            assert.ok(
              !deriveProject(project, result.run).availableWork.some(
                (item) => item.id === dependent.id,
              ),
            );
            assert.throws(
              () =>
                runProjectChange(
                  project,
                  result.run,
                  dependent.id,
                  dependent.options[0].id,
                  receipt(),
                ),
              /First ship:/,
            );
          }
          const complete = shipSet(
            project,
            new Set(project.work.map((item) => item.id)),
          );
          const regressed = runProjectChange(
            project,
            complete,
            work.id,
            option.id,
            receipt(),
          );
          const afterRegression = deriveProject(project, regressed.run);
          for (const dependent of dependents) {
            assert.ok(
              !afterRegression.shippedIds.includes(dependent.id),
              `${dependent.id}: cannot survive a failed prerequisite`,
            );
            assert.ok(
              !Object.hasOwn(regressed.run.selections, dependent.id),
              `${dependent.id}: invalid configuration must be removed`,
            );
          }
          const unaffected = project.work.filter(
            (item) => item.id !== work.id && !dependents.includes(item),
          );
          for (const independent of unaffected) {
            assert.ok(
              afterRegression.shippedIds.includes(independent.id),
              `${independent.id}: unrelated work survives the regression`,
            );
          }
        }
      }
    }
    assert.ok(
      adverseApproaches > 0,
      "The catalog includes attempts whose consequences need repair.",
    );
    assert.ok(
      testedDependency,
      "At least one insufficient approach exercises a real dependent request.",
    );
  });

  it("keeps every project's progress and modeled consequences isolated in a saved portfolio", () => {
    const portfolio = projectPortfolioSchema.parse({
      activeProject: projects[0].id,
      runs: Object.fromEntries(
        projects.map((project) => [project.id, emptyProjectRun()]),
      ),
    });
    for (const project of projects) {
      const before = structuredClone(portfolio);
      const first = deriveProject(project, portfolio.runs[project.id])
        .availableWork[0];
      const choice = first.options.find(
        (option) => option.outcome === "shipped",
      );
      assert.ok(choice);
      portfolio.runs[project.id] = runProjectChange(
        project,
        portfolio.runs[project.id],
        first.id,
        choice.id,
        receipt(),
      ).run;
      for (const other of projects.filter((item) => item.id !== project.id)) {
        assert.deepEqual(
          portfolio.runs[other.id],
          before.runs[other.id],
          `${project.id}: must not alter ${other.id}`,
        );
        assert.deepEqual(
          deriveProject(other, portfolio.runs[other.id]),
          deriveProject(other, before.runs[other.id]),
        );
      }
    }
    const restored = projectPortfolioSchema.parse(
      JSON.parse(JSON.stringify(portfolio)),
    );
    for (const project of projects) {
      assert.equal(
        deriveProject(project, restored.runs[project.id]).shippedIds.length,
        1,
        `${project.id}: its own progress survives reload`,
      );
    }
  });

  it("resolves an identically named approach inside its own project and request", () => {
    const firstProject = projects[0];
    const secondProject = structuredClone(projects[1]);
    const firstWork = deriveProject(firstProject, emptyProjectRun())
      .availableWork[0];
    const secondWork = deriveProject(secondProject, emptyProjectRun())
      .availableWork[0];
    const firstOption = firstWork.options.find(
      (option) => option.outcome === "shipped",
    );
    const secondOption = secondWork.options.find(
      (option) => option.outcome === "shipped",
    );
    assert.ok(firstOption && secondOption);
    // Reusing a local approach name is allowed; its effects belong to its project.
    secondOption.id = firstOption.id;
    const first = runProjectChange(
      firstProject,
      emptyProjectRun(),
      firstWork.id,
      firstOption.id,
      receipt(),
    );
    const firstSnapshot = structuredClone(first);
    const second = runProjectChange(
      secondProject,
      emptyProjectRun(),
      secondWork.id,
      firstOption.id,
      receipt(),
    );
    assert.equal(second.option.summary, secondOption.summary);
    assert.deepEqual(second.option.effects, secondOption.effects);
    assert.notEqual(first.option.summary, second.option.summary);
    assert.deepEqual(first, firstSnapshot);
    assert.deepEqual(deriveProject(firstProject, first.run).shippedIds, [
      firstWork.id,
    ]);
    assert.deepEqual(deriveProject(secondProject, second.run).shippedIds, [
      secondWork.id,
    ]);
  });
});

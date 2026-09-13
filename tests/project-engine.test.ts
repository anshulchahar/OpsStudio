import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveProject,
  emptyProjectRun,
  projectPortfolioSchema,
  projectRunSchema,
  renderProjectReport,
  runProjectChange,
} from "../src/lib/project-engine.ts";
import type {
  Approach,
  PracticeProject,
  WorkOrder,
} from "../src/lib/project-types.ts";

function approach(
  id: string,
  effects: Approach["effects"],
  outcome: Approach["outcome"] = "shipped",
): Approach {
  return {
    id,
    title: id,
    summary: "A concrete change.",
    tradeoff: "Cost versus resilience.",
    changes: ["Create the configuration."],
    effects,
    evidence: [
      {
        label: "Verification",
        detail: "Modeled check result.",
        status: outcome === "shipped" ? "pass" : "fail",
      },
    ],
    artifact: {
      filename: "config.yaml",
      language: "yaml",
      body: "enabled: true",
    },
    outcome,
    learning: "Understand the consequence.",
    recommendation: "Verify the next dependency.",
  };
}

function work(id: string, requires: string[], options: Approach[]): WorkOrder {
  return {
    id,
    title: `Work ${id}`,
    kind: "request",
    from: { name: "Sam", role: "Engineer" },
    brief: "Make this service dependable.",
    why: "Users need it.",
    skills: ["Delivery"],
    requires,
    affected: ["api"],
    options,
    hints: ["Inspect the evidence."],
    reference: { title: "Reference", url: "https://example.com" },
  };
}

// Deliberately out of dependency order to exercise persisted-key and catalog-order independence.
const project: PracticeProject = {
  id: "fixture",
  name: "Example workspace",
  industry: "Retail",
  tagline: "Ship an order service.",
  description: "A test project.",
  brief: "Keep orders moving.",
  stage: "First steps",
  accent: "#b54b32",
  icon: "store",
  components: [],
  connections: [],
  target: "A resilient order flow.",
  initialMetrics: {
    availability: 90,
    risk: 60,
    latency: 300,
    monthlyCost: 100,
  },
  work: [
    work(
      "release",
      ["identity", "database"],
      [approach("canary", { availability: 2, monthlyCost: 10 })],
    ),
    work(
      "identity",
      ["foundation"],
      [approach("oidc", { risk: -20, latency: 20 })],
    ),
    work(
      "database",
      ["foundation"],
      [approach("replica", { availability: 3, monthlyCost: 40 })],
    ),
    work(
      "foundation",
      [],
      [
        approach("simple", { risk: -5, latency: -30 }),
        approach("managed", { risk: -10, monthlyCost: 20 }),
        approach("shortcut", { risk: 25, availability: -10 }, "needs-work"),
      ],
    ),
  ],
};

const at = "2026-09-13T12:00:00.000Z";
function change(
  run: ReturnType<typeof emptyProjectRun>,
  workId: string,
  optionId: string,
  id = `${workId}-${run.history.length}`,
) {
  return runProjectChange(project, run, workId, optionId, { id, at });
}

describe("project workspaces", () => {
  it("starts with meaningful work and gives legacy portfolios isolated defaults", () => {
    const first = projectPortfolioSchema.parse(undefined);
    const second = projectPortfolioSchema.parse({});
    first.runs.fixture = emptyProjectRun();
    assert.deepEqual(second, { activeProject: "cornerstone", runs: {} });
    const result = deriveProject(project, emptyProjectRun());
    assert.deepEqual(result.metrics, project.initialMetrics);
    assert.deepEqual(
      result.availableWork.map((item) => item.id),
      ["foundation"],
    );
    assert.deepEqual(result.shippedIds, []);
    assert.equal(result.latest, null);
  });

  it("supports branching prerequisites and resolves selections regardless of key order", () => {
    const result = deriveProject(project, {
      ...emptyProjectRun(),
      selections: {
        release: "canary",
        identity: "oidc",
        database: "replica",
        foundation: "simple",
      },
    });
    assert.deepEqual(result.shippedIds, [
      "release",
      "identity",
      "database",
      "foundation",
    ]);
    assert.deepEqual(result.metrics, {
      availability: 95,
      risk: 35,
      latency: 290,
      monthlyCost: 150,
    });
    let run = change(emptyProjectRun(), "foundation", "simple").run;
    run = change(run, "identity", "oidc").run;
    assert.throws(
      () => change(run, "release", "canary"),
      /First ship: Work database/,
    );
    run = change(run, "database", "replica").run;
    const release = change(run, "release", "canary");
    assert.equal(
      deriveProject(project, release.run).latest?.work.id,
      "release",
    );
  });

  it("replaces a decision instead of stacking its effects and does not mutate inputs", () => {
    const initial = emptyProjectRun();
    const snapshot = structuredClone(initial);
    const first = change(initial, "foundation", "simple");
    assert.deepEqual(initial, snapshot);
    const firstSnapshot = structuredClone(first.run);
    const repeat = change(first.run, "foundation", "simple");
    assert.deepEqual(repeat.after, first.after);
    assert.equal(repeat.run.history.length, 2);
    const replacement = change(repeat.run, "foundation", "managed");
    assert.deepEqual(replacement.after, {
      availability: 90,
      risk: 50,
      latency: 300,
      monthlyCost: 120,
    });
    assert.deepEqual(first.run, firstSnapshot);
    assert.deepEqual(project.initialMetrics, {
      availability: 90,
      risk: 60,
      latency: 300,
      monthlyCost: 100,
    });
  });

  it("shows adverse outcomes without marking them shipped or unlocking dependent work", () => {
    const result = change(emptyProjectRun(), "foundation", "shortcut");
    const derived = deriveProject(project, result.run);
    assert.equal(result.after.risk, 85);
    assert.equal(result.after.availability, 80);
    assert.deepEqual(derived.shippedIds, []);
    assert.deepEqual(
      derived.availableWork.map((item) => item.id),
      ["foundation"],
    );
    assert.equal(derived.latest?.option.outcome, "needs-work");
    assert.throws(
      () => change(result.run, "identity", "oidc"),
      /First ship: Work foundation/,
    );
  });

  it("invalidates dependent configurations when a prerequisite regresses, keeping receipts", () => {
    let run = change(emptyProjectRun(), "foundation", "simple").run;
    run = change(run, "identity", "oidc").run;
    run = change(run, "database", "replica").run;
    run = change(run, "release", "canary").run;
    const historical = structuredClone(run.history);
    const regressed = change(run, "foundation", "shortcut");
    assert.deepEqual(regressed.run.selections, { foundation: "shortcut" });
    assert.deepEqual(regressed.run.history.slice(0, 4), historical);
    assert.deepEqual(regressed.after, {
      availability: 80,
      risk: 85,
      latency: 300,
      monthlyCost: 100,
    });
    const repaired = change(regressed.run, "foundation", "managed");
    assert.deepEqual(deriveProject(project, repaired.run).shippedIds, [
      "foundation",
    ]);
    assert.deepEqual(repaired.run.selections, { foundation: "managed" });
  });

  it("ignores unknown, invalid, or blocked saved selections and rejects unknown commands", () => {
    const run = {
      ...emptyProjectRun(),
      selections: {
        release: "canary",
        foundation: "missing-option",
        fabricated: "anything",
      },
      history: [{ id: "stale", workId: "release", optionId: "canary", at }],
    };
    const derived = deriveProject(project, run);
    assert.deepEqual(derived.metrics, project.initialMetrics);
    assert.equal(derived.latest, null);
    assert.deepEqual(derived.shippedIds, []);
    assert.throws(
      () => change(run, "unknown", "unknown"),
      /not part of this project/,
    );
    assert.throws(
      () => change(run, "foundation", "unknown"),
      /available approach/,
    );
    const cycle = {
      ...project,
      work: [
        work("a", ["b"], [approach("yes", {})]),
        work("b", ["a"], [approach("yes", {})]),
      ],
    };
    assert.deepEqual(
      deriveProject(cycle, {
        ...emptyProjectRun(),
        selections: { a: "yes", b: "yes" },
      }).shippedIds,
      [],
    );
  });

  it("bounds modeled measurements and rounds them for display", () => {
    const boundsProject = {
      ...project,
      work: [
        work(
          "extreme",
          [],
          [
            approach("up", {
              availability: 100,
              risk: -1000,
              latency: -1000,
              monthlyCost: 2_000_000,
            }),
          ],
        ),
      ],
    };
    assert.deepEqual(
      deriveProject(boundsProject, {
        ...emptyProjectRun(),
        selections: { extreme: "up" },
      }).metrics,
      {
        availability: 99.99,
        risk: 0,
        latency: 1,
        monthlyCost: 1_000_000,
      },
    );
    const opposite = {
      ...boundsProject,
      work: [
        work(
          "extreme",
          [],
          [
            approach("down", {
              availability: -1000,
              risk: 1000,
              latency: 200_000,
              monthlyCost: -1000,
            }),
          ],
        ),
      ],
    };
    assert.deepEqual(
      deriveProject(opposite, {
        ...emptyProjectRun(),
        selections: { extreme: "down" },
      }).metrics,
      {
        availability: 0,
        risk: 100,
        latency: 100_000,
        monthlyCost: 0,
      },
    );
  });

  it("caps history while preserving current configuration and rejects corrupted persistence", () => {
    let run = emptyProjectRun();
    for (let index = 0; index < 45; index += 1)
      run = change(run, "foundation", "simple", `receipt-${index}`).run;
    assert.equal(run.history.length, 40);
    assert.equal(run.history[0].id, "receipt-5");
    assert.deepEqual(run.selections, { foundation: "simple" });
    assert.throws(
      () => change(run, "foundation", "simple", "receipt-44"),
      /already exists/,
    );
    assert.equal(
      projectRunSchema.safeParse({ ...run, activeWorkId: 123 }).success,
      false,
    );
    assert.equal(
      projectRunSchema.safeParse({ ...run, activeWorkId: "x".repeat(65) })
        .success,
      false,
    );
    assert.equal(
      projectRunSchema.safeParse({
        ...run,
        history: [...run.history, run.history[0]],
      }).success,
      false,
    );
    assert.equal(
      projectRunSchema.safeParse({
        ...run,
        history: [
          {
            id: "bad",
            workId: "foundation",
            optionId: "simple",
            at: "yesterday",
          },
        ],
      }).success,
      false,
    );
    assert.equal(
      projectRunSchema.safeParse({
        ...run,
        selections: Object.fromEntries(
          Array.from({ length: 81 }, (_, index) => [`work-${index}`, "option"]),
        ),
      }).success,
      false,
    );
    assert.equal(
      projectPortfolioSchema.safeParse({
        runs: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => [
            `project-${index}`,
            emptyProjectRun(),
          ]),
        ),
      }).success,
      false,
    );
    assert.equal(
      projectPortfolioSchema.safeParse({
        runs: Object.fromEntries(
          Array.from({ length: 9 }, (_, index) => [`project-${index}`, run]),
        ),
      }).success,
      false,
    );
  });

  it("exports decisions, consequences, and historical receipts as modeled evidence", () => {
    let run = change(emptyProjectRun(), "foundation", "simple").run;
    run = change(run, "foundation", "managed").run;
    const report = renderProjectReport(project, run);
    assert.match(report, /not measurements from a deployed production system/);
    assert.match(report, /Approach: managed \(shipped\)/);
    assert.match(report, /simple \(historical choice\)/);
    assert.match(report, /What this demonstrates:/);
    assert.match(report, /Recommended next improvement:/);
  });
});

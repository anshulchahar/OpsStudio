import { describe, it } from "node:test";
import { expect } from "./assert.ts";
import {
  executeAction,
  initialSystem,
  securityScore,
  risks,
  savedProgressSchema,
  emptyProgress,
  type ActionId,
} from "../src/lib/engine.ts";
import { missions } from "../src/lib/curriculum.ts";
describe("the learning journey", () => {
  it("supports all 20 discoveries in order without mutating prior checkpoints", () => {
    let state = { ...initialSystem };
    for (const mission of missions) {
      const before = structuredClone(state);
      const result = executeAction(state, mission.action);
      expect(state).toEqual(before);
      expect(result.steps.length).toBeGreaterThan(1);
      expect(result.evidence.length).toBeGreaterThan(0);
      state = result.state;
    }
    expect(securityScore(state)).toBe(100);
    expect(risks(state)).toEqual([]);
    expect(state.recoveryTested).toBe(true);
  });
  it("requires identity before ownership and tests before deployment", () => {
    expect(() => executeAction(initialSystem, "authorize")).toThrow(
      "authentication",
    );
    expect(() => executeAction(initialSystem, "deploy")).toThrow("tests");
  });
  it("preserves security controls through incident recovery and reconciles drift", () => {
    let state = missions.reduce((s, m) => executeAction(s, m.action).state, {
      ...initialSystem,
    });
    state = executeAction(state, "outage").state;
    expect(state.healthy).toBe(false);
    state = executeAction(state, "recover").state;
    expect(state.healthy && state.authorization).toBe(true);
    state = executeAction(state, "drift").state;
    expect(risks(state)).toContain("Configuration drift detected");
    expect(executeAction(state, "reconcile").state.drift).toBe(false);
  });
  it("rejects corrupt saved data and unsupported actions", () => {
    expect(
      savedProgressSchema.safeParse({ ...emptyProgress, activeMission: 20 })
        .success,
    ).toBe(false);
    expect(
      savedProgressSchema.safeParse({
        ...emptyProgress,
        state: { ...initialSystem, replicas: 500 },
      }).success,
    ).toBe(false);
    expect(() =>
      executeAction(initialSystem, "delete-production" as ActionId),
    ).toThrow("Unknown");
  });
});

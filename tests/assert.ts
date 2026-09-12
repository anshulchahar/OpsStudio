import assert from "node:assert/strict";
export const expect = (value: unknown) => ({
  toBe: (expected: unknown) => assert.equal(value, expected),
  toEqual: (expected: unknown) => assert.deepEqual(value, expected),
  toBeGreaterThan: (expected: number) =>
    assert.ok(typeof value === "number" && value > expected),
  toHaveLength: (expected: number) =>
    assert.equal((value as { length: number }).length, expected),
  toContain: (expected: unknown) =>
    assert.ok((value as unknown[]).includes(expected)),
  toThrow: (expected: string) =>
    assert.throws(
      value as () => unknown,
      (error) => error instanceof Error && error.message.includes(expected),
    ),
  rejects: {
    toThrow: async (expected: string) =>
      assert.rejects(
        value as Promise<unknown>,
        (error) => error instanceof Error && error.message.includes(expected),
      ),
  },
});

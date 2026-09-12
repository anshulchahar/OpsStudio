import { it } from "node:test";
import { expect } from "./assert.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { labRecipe, recipeIds } from "../src/lib/lab-recipes.ts";
for (const recipe of recipeIds)
  it(`executes real HTTP checks for ${recipe}`, async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "-e", labRecipe(recipe)],
      { timeout: 10000 },
    );
    const result = JSON.parse(stdout);
    expect(result.passed).toBe(true);
    expect(
      result.results.filter((r: { status: string }) => r.status === "fail"),
    ).toHaveLength(0);
    if (recipe === "authorization") {
      expect(
        result.results.some((r: { label: string }) =>
          r.label.includes("Before:"),
        ),
      ).toBe(true);
      expect(
        result.results.some((r: { label: string }) =>
          r.label.includes("After:"),
        ),
      ).toBe(true);
      expect(result.results).toHaveLength(6);
    }
  });

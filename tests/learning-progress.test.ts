import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chapters, missions } from "../src/lib/curriculum.ts";
import {
  getLearningProgress,
  isMissionUnlocked,
  MISSION_XP,
} from "../src/lib/learning-progress.ts";

const allIds = missions.map((mission) => mission.id);

describe("learning progress", () => {
  it("starts with one available mission and no unearned rewards", () => {
    const progress = getLearningProgress([]);
    assert.equal(progress.completedCount, 0);
    assert.equal(progress.xp, 0);
    assert.equal(progress.level, 1);
    assert.equal(progress.levelProgress, 0);
    assert.equal(progress.nextMissionIndex, 0);
    assert.deepEqual(progress.earnedBadges, []);
    assert.equal(isMissionUnlocked(0, []), true);
    assert.equal(isMissionUnlocked(1, []), false);
  });

  it("rewards each known mission once and ignores unknown completion IDs", () => {
    const completed = [allIds[0], allIds[0], "unknown", allIds[1], "unknown"];
    const progress = getLearningProgress(completed);
    assert.equal(progress.completedCount, 2);
    assert.equal(progress.xp, 2 * MISSION_XP);
    assert.equal(progress.level, 1);
    assert.equal(progress.levelProgress, 50);
    assert.equal(progress.nextMissionIndex, 2);
  });

  it("awards chapter badges for their actual missions, not a completion count", () => {
    const mixedChapter = [allIds[0], allIds[1], allIds[2], allIds[4]];
    const partial = getLearningProgress(mixedChapter);
    assert.equal(partial.level, 2);
    assert.equal(partial.levelProgress, 0);
    assert.deepEqual(partial.earnedBadges, []);
    assert.deepEqual(getLearningProgress(allIds.slice(0, 4)).earnedBadges, [
      { chapter: 0, title: chapters[0].title },
    ]);
  });

  it("recommends the earliest gap while completed later missions remain reviewable", () => {
    const completed = [allIds[0], allIds[2], allIds[3], allIds[5]];
    assert.equal(getLearningProgress(completed).nextMissionIndex, 1);
    assert.equal(isMissionUnlocked(0, completed), true);
    assert.equal(isMissionUnlocked(1, completed), true);
    assert.equal(isMissionUnlocked(2, completed), true);
    assert.equal(isMissionUnlocked(5, completed), true);
    assert.equal(isMissionUnlocked(4, completed), false);
    assert.equal(isMissionUnlocked(6, completed), false);
  });

  it("caps the final level, completes its meter, and keeps all missions reviewable", () => {
    const progress = getLearningProgress([...allIds, ...allIds, "unknown"]);
    assert.equal(progress.completedCount, 20);
    assert.equal(progress.xp, 20 * MISSION_XP);
    assert.equal(progress.level, 6);
    assert.equal(progress.levelProgress, 100);
    assert.equal(progress.nextMissionIndex, null);
    assert.deepEqual(
      progress.earnedBadges,
      chapters.map((chapter, index) => ({
        chapter: index,
        title: chapter.title,
      })),
    );
    assert.ok(missions.every((_, index) => isMissionUnlocked(index, allIds)));
  });

  it("rejects invalid mission positions", () => {
    for (const index of [-1, 0.5, missions.length, Number.NaN, Infinity]) {
      assert.equal(isMissionUnlocked(index, allIds), false);
    }
  });

  it("does not mutate saved completions or share reward arrays between calls", () => {
    const completed = Object.freeze([...allIds.slice(0, 4), allIds[0]]);
    const before = [...completed];
    const progress = getLearningProgress(completed);
    isMissionUnlocked(4, completed);
    progress.earnedBadges[0].title = "Changed by a caller";
    progress.earnedBadges.push({ chapter: 99, title: "Not earned" });
    assert.deepEqual(completed, before);
    assert.deepEqual(getLearningProgress(completed).earnedBadges, [
      { chapter: 0, title: chapters[0].title },
    ]);
  });
});

import { chapters, missions } from "./curriculum.ts";

export const MISSION_XP = 100;

const MISSIONS_PER_LEVEL = 4;
const levelTitles = [
  "Curious newcomer",
  "System explorer",
  "Delivery builder",
  "Security detective",
  "Reliability navigator",
  "Systems thinker",
] as const;
const knownMissionIds = new Set(missions.map((mission) => mission.id));

function completedMissions(completed: readonly string[]) {
  return new Set(completed.filter((id) => knownMissionIds.has(id)));
}

export function getLearningProgress(completed: readonly string[]) {
  const verified = completedMissions(completed);
  const completedCount = verified.size;
  const level = Math.min(
    Math.floor(completedCount / MISSIONS_PER_LEVEL) + 1,
    levelTitles.length,
  );
  const nextIndex = missions.findIndex((mission) => !verified.has(mission.id));

  return {
    completedCount,
    xp: completedCount * MISSION_XP,
    level,
    levelTitle: levelTitles[level - 1],
    levelProgress:
      nextIndex === -1
        ? 100
        : ((completedCount % MISSIONS_PER_LEVEL) / MISSIONS_PER_LEVEL) * 100,
    nextMissionIndex: nextIndex === -1 ? null : nextIndex,
    earnedBadges: chapters.flatMap((chapter, index) => {
      const chapterMissions = missions.filter(
        (mission) => mission.chapter === index,
      );
      return chapterMissions.length > 0 &&
        chapterMissions.every((mission) => verified.has(mission.id))
        ? [{ chapter: index, title: chapter.title }]
        : [];
    }),
  };
}

export function isMissionUnlocked(
  index: number,
  completed: readonly string[],
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= missions.length) {
    return false;
  }

  const verified = completedMissions(completed);
  if (verified.has(missions[index].id)) return true;

  const nextIndex = missions.findIndex((mission) => !verified.has(mission.id));
  return nextIndex !== -1 && index <= nextIndex;
}

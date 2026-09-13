import { foundationProjects } from "./projects-foundations.ts";
import { advancedProjects } from "./projects-advanced.ts";
import { platformProjects } from "./projects-platform.ts";

export const projects = [
  ...foundationProjects,
  ...platformProjects.filter((project) => project.id === "northstar"),
  ...advancedProjects,
  ...platformProjects.filter((project) => project.id !== "northstar"),
];

export function findProject(id: string) {
  return projects.find((project) => project.id === id);
}

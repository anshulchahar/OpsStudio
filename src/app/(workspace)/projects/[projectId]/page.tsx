import { notFound } from "next/navigation";
import { findProject, projects } from "@/lib/projects";
import { ProjectWorkspace } from "@/components/project-workspace";
export function generateStaticParams() {
  return projects.map((project) => ({ projectId: project.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = findProject(projectId);
  return { title: project ? `${project.name} workspace` : "Project not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!findProject(projectId)) notFound();
  return <ProjectWorkspace projectId={projectId} />;
}

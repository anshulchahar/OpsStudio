export type Metrics = {
  availability: number;
  risk: number;
  latency: number;
  monthlyCost: number;
};

// Bump when changing the meaning of authored work. Applied receipts retain their
// own snapshot and therefore do not inherit subsequent editorial revisions.
export const PROJECT_CATALOG_VERSION = "2026-09-13.1";

export type ProjectComponent = {
  id: string;
  label: string;
  kind: "client" | "edge" | "service" | "data" | "queue" | "control";
  description: string;
};

export type Approach = {
  id: string;
  title: string;
  summary: string;
  tradeoff: string;
  changes: string[];
  effects: Partial<Metrics>;
  evidence: {
    label: string;
    detail: string;
    status: "pass" | "warn" | "fail";
  }[];
  artifact: { filename: string; language: string; body: string };
  outcome: "shipped" | "needs-work";
  learning: string;
  recommendation: string;
};

export type WorkOrder = {
  id: string;
  title: string;
  kind: "request" | "incident" | "experiment" | "review";
  from: { name: string; role: string };
  brief: string;
  why: string;
  skills: string[];
  requires: string[];
  affected: string[];
  options: Approach[];
  hints: string[];
  reference: { title: string; url: string };
};

export type PracticeProject = {
  id: string;
  name: string;
  industry: string;
  tagline: string;
  description: string;
  brief: string;
  stage: "First steps" | "Shipping" | "On call" | "Systems design";
  accent: string;
  icon: string;
  components: ProjectComponent[];
  connections: { from: string; to: string; label: string }[];
  initialMetrics: Metrics;
  target: string;
  work: WorkOrder[];
};

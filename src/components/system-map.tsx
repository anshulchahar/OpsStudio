"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  MarkerType,
  type NodeChange,
} from "@xyflow/react";
import {
  Globe,
  ShieldCheck,
  Server,
  Database,
  GitBranch,
  Workflow,
  Activity,
  LockKeyhole,
  Box,
  Fingerprint,
  ArrowUpRight,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { SystemState } from "@/lib/engine";
import "@xyflow/react/dist/style.css";

type ServiceData = {
  label: string;
  subtitle: string;
  kind: string;
  status: string;
  tone: string;
  active: boolean;
  vertical: boolean;
  selected?: boolean;
  dim?: boolean;
  onInspect: (id: string) => void;
};
type ServiceNodeType = Node<ServiceData>;
const icons: Record<string, typeof Globe> = {
  browser: Globe,
  gateway: ShieldCheck,
  api: Server,
  database: Database,
  repository: GitBranch,
  pipeline: Workflow,
  monitor: Activity,
  secrets: LockKeyhole,
};

const ServiceNode = memo(function ServiceNode({
  id,
  data,
}: NodeProps<ServiceNodeType>) {
  const Icon = icons[data.kind] || Box;
  return (
    <button
      className={`service-node ${data.tone} ${data.active ? "active" : ""} ${data.selected ? "is-selected" : ""} ${data.dim ? "dim" : ""}`}
      onClick={() => data.onInspect(id)}
      aria-label={`Inspect ${data.label}`}
    >
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
      />
      <div className="node-head">
        <span className="node-icon">
          <Icon size={19} strokeWidth={1.7} />
        </span>
        <ArrowUpRight size={12} className="node-open" />
      </div>
      <strong>{data.label}</strong>
      <span className="node-subtitle">{data.subtitle}</span>
      <span className="node-status">
        <i />
        {data.status}
      </span>
      <Handle
        type="source"
        position={data.vertical ? Position.Bottom : Position.Right}
      />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Top} id="top" />
    </button>
  );
});
const nodeTypes = { service: ServiceNode };

export const componentDetails: Record<
  string,
  { title: string; role: string; explanation: string; responsibility: string }
> = {
  browser: {
    title: "Customer portal",
    role: "The customer's starting point",
    explanation:
      "The browser shows the claim form and sends requests. Treat anything arriving from it as untrusted input; users can change their own requests.",
    responsibility:
      "Present information, collect input, and explain the outcome.",
  },
  gateway: {
    title: "API gateway",
    role: "The front door to the service",
    explanation:
      "The gateway routes traffic to the claims API. It can enforce HTTPS and other entry-point policies. Application authorization is still required behind it.",
    responsibility: "Route requests through the intended entry point.",
  },
  api: {
    title: "Claims service",
    role: "Where the business rules live",
    explanation:
      "The API validates input, checks identity and ownership, and asks storage to read or write claims. It should use the least privileges necessary.",
    responsibility: "Make and enforce decisions about a claim.",
  },
  database: {
    title: "Claims database",
    role: "The system's durable memory",
    explanation:
      "The database preserves claims beyond a single request or application process. Its access policy and recovery strategy deserve their own verification.",
    responsibility: "Preserve correct data and restrict who can access it.",
  },
  repository: {
    title: "Source repository",
    role: "A history you can reason about",
    explanation:
      "Source control records changes to code and configuration. Commits give the team context, reviewable differences, and recoverable versions.",
    responsibility: "Keep an understandable history without storing secrets.",
  },
  pipeline: {
    title: "Delivery pipeline",
    role: "Your repeatable path to a release",
    explanation:
      "The pipeline runs checks, builds an artifact, and deploys an approved revision. A failed gate must stop dependent release work.",
    responsibility: "Turn release decisions into repeatable verification.",
  },
  monitor: {
    title: "Observability",
    role: "Evidence about a running system",
    explanation:
      "Logs, metrics, and traces help connect a customer's symptom to a component. Good telemetry answers useful questions without exposing sensitive data.",
    responsibility: "Make failures understandable and actionable.",
  },
  secrets: {
    title: "Secret boundary",
    role: "Credentials with limited exposure",
    explanation:
      "A secret store provides values to authorized workloads without embedding them in source code. Access, rotation, and auditing remain essential.",
    responsibility: "Grant the right process access to the right credential.",
  },
};

export function SystemMap({
  state,
  running = false,
  activeNode = null,
  focus = null,
  onInspect,
  compact = false,
}: {
  state: SystemState;
  running?: boolean;
  activeNode?: string | null;
  focus?: string | null;
  onInspect: (id: string) => void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < 680),
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const moveNodes = (changes: NodeChange[]) =>
    setPositions((old) => {
      const moving = changes.filter((c) => c.type === "position" && c.position);
      if (!moving.length) return old;
      const next = { ...old };
      for (const change of moving)
        if (change.type === "position" && change.position)
          next[`${narrow ? "narrow" : "wide"}:${change.id}`] = change.position;
      return next;
    });
  const nodes = useMemo<ServiceNodeType[]>(() => {
    const stacked: Record<string, { x: number; y: number }> = {
      browser: { x: 0, y: 0 },
      gateway: { x: 0, y: 145 },
      api: { x: 0, y: 290 },
      database: { x: 0, y: 435 },
      repository: { x: 220, y: 0 },
      pipeline: { x: 220, y: 145 },
      secrets: { x: 220, y: 290 },
      monitor: { x: 220, y: 435 },
    };
    const make = (
      id: string,
      x: number,
      y: number,
      label: string,
      subtitle: string,
      status: string,
      tone = "blue",
      dim = false,
    ): ServiceNodeType => ({
      id,
      type: "service",
      width: 176,
      height: 114,
      position:
        positions[`${narrow ? "narrow" : "wide"}:${id}`] ||
        (narrow ? stacked[id] : { x, y }),
      data: {
        label,
        subtitle,
        kind: id,
        vertical: narrow,
        status,
        tone,
        active: running && activeNode === id,
        selected: focus === id,
        dim: dim && activeNode !== id,
        onInspect,
      },
    });
    const base = [
      make(
        "browser",
        0,
        145,
        "Customer portal",
        "Web application",
        "Ready locally",
        "blue",
      ),
      make(
        "gateway",
        235,
        145,
        "API gateway",
        state.tls ? "HTTPS · TLS protected" : "HTTP · Entry point",
        state.tls ? "Encrypted" : "Unprotected",
        "violet",
      ),
      make(
        "api",
        470,
        145,
        "Claims service",
        state.container
          ? `Container · ${state.replicas} replica${state.replicas > 1 ? "s" : ""}`
          : "Application runtime",
        !state.healthy
          ? "Unhealthy"
          : state.deployed
            ? "Deployed"
            : "Ready locally",
        state.healthy ? "blue" : "rose",
      ),
      make(
        "database",
        705,
        145,
        "Claims database",
        "PostgreSQL",
        state.authorization ? "Access restricted" : "Access unchecked",
        "teal",
      ),
    ];
    if (!compact)
      base.push(
        make(
          "repository",
          115,
          -40,
          "Source control",
          "Code & configuration",
          state.repository ? "Revision saved" : "Not connected",
          "slate",
          !state.repository,
        ),
        make(
          "pipeline",
          470,
          -40,
          "CI/CD pipeline",
          "Test → build → deploy",
          state.pipeline ? "Gates enabled" : "Not connected",
          "violet",
          !state.pipeline,
        ),
        make(
          "secrets",
          235,
          335,
          "Secret boundary",
          "Restricted credentials",
          state.secrets ? "Referenced safely" : "Not configured",
          "amber",
          !state.secrets,
        ),
        make(
          "monitor",
          705,
          335,
          "Observability",
          "Logs · metrics · traces",
          state.observability ? "Signals connected" : "Not connected",
          "teal",
          !state.observability,
        ),
      );
    return base;
  }, [
    state,
    running,
    activeNode,
    focus,
    onInspect,
    compact,
    positions,
    narrow,
  ]);
  const edges = useMemo<Edge[]>(() => {
    const edge = (
      source: string,
      target: string,
      enabled = true,
      extra: Partial<Edge> = {},
    ): Edge => ({
      id: `${source}-${target}`,
      source,
      target,
      type: "smoothstep",
      animated:
        running && enabled && (source === activeNode || target === activeNode),
      style: {
        stroke: enabled
          ? !state.healthy && target === "api"
            ? "#e76e77"
            : "#bd8a64"
          : "#535b50",
        strokeWidth: enabled ? 1.65 : 1.1,
        strokeDasharray: enabled ? undefined : "4 5",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: enabled ? "#bd8a64" : "#535b50",
        width: 14,
        height: 14,
      },
      ...extra,
    });
    const base = [
      edge("browser", "gateway"),
      edge("gateway", "api"),
      edge("api", "database"),
    ];
    if (!compact)
      base.push(
        edge("repository", "pipeline", state.pipeline, {
          label: state.pipeline ? "on commit" : "",
          labelStyle: { fill: "#bcc1ad", fontSize: 10 },
        }),
        edge("pipeline", "api", state.pipeline, {
          sourceHandle: "bottom",
          targetHandle: "top",
        }),
        edge("secrets", "api", state.secrets, { targetHandle: "top" }),
        edge("api", "monitor", state.observability, {
          sourceHandle: "bottom",
          targetHandle: "top",
        }),
      );
    return base;
  }, [state, running, activeNode, compact]);
  return (
    <div
      ref={containerRef}
      className={`system-map ${compact ? "compact" : ""} ${running ? "is-running" : ""} ${narrow ? "narrow" : ""}`}
    >
      <div className="map-environment">
        <span className="status-dot" /> NORTHSTAR /{" "}
        {state.deployed ? "TRAINING" : "DEVELOPMENT"}
      </div>
      <ReactFlow
        key={narrow ? "stacked" : "wide"}
        nodes={nodes}
        onNodesChange={moveNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: compact ? 0.12 : 0.13 }}
        nodesDraggable={!compact}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={!compact}
        zoomOnScroll={!compact}
        minZoom={0.35}
        maxZoom={1.25}
        ariaLabelConfig={{
          "controls.zoomIn.ariaLabel": "Zoom in to the system map",
          "controls.zoomOut.ariaLabel": "Zoom out of the system map",
          "controls.fitView.ariaLabel": "Fit the system map",
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="#414b41"
        />
        {!compact && <Controls showInteractive={false} />}
      </ReactFlow>
      <div className="map-legend">
        <span>
          <i className="legend-line" />
          Request path
        </span>
        <span>
          <i className="legend-dashed" />
          Supporting service
        </span>
        <span className="map-simulation">
          <Fingerprint size={12} />
          Interactive simulation
        </span>
      </div>
      {!state.healthy && (
        <div className="map-alert">
          <AlertTriangle size={14} />
          Training incident · service unavailable
        </div>
      )}
      {state.authorization && state.healthy && (
        <span className="map-trust">
          <Check size={12} /> Ownership checks enabled
        </span>
      )}
    </div>
  );
}

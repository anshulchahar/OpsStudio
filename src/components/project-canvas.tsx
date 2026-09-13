"use client";
import { useState } from "react";
import {
  Activity,
  Database,
  Globe,
  LockKeyhole,
  Server,
  Workflow,
  X,
} from "lucide-react";
import type { PracticeProject, Metrics } from "@/lib/project-types";
const icons = {
  client: Globe,
  edge: LockKeyhole,
  service: Server,
  data: Database,
  queue: Workflow,
  control: Activity,
};
export function ProjectCanvas({
  project,
  affected,
  running,
  metrics,
  before,
}: {
  project: PracticeProject;
  affected: string[];
  running: boolean;
  metrics: Metrics;
  before?: Metrics;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const component = project.components.find((item) => item.id === selected);
  const positions = Object.fromEntries(
    project.components.map((item, index) => [
      item.id,
      { x: 98 + (index % 2) * 216, y: 76 + Math.floor(index / 2) * 134 },
    ]),
  );
  return (
    <div className="operating-canvas">
      <header>
        <span>
          <Activity size={14} /> System view
        </span>
        <span className="practice-label">
          <i />
          Practice environment
        </span>
      </header>
      <div className={`operating-network ${running ? "running" : ""}`}>
        <svg
          viewBox="0 0 412 420"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${project.name} system connections`}
          className="operating-wires"
        >
          <defs>
            <marker
              id={`arrow-${project.id}`}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L5,2.5 L0,5" fill="currentColor" />
            </marker>
          </defs>
          {project.connections.map((connection, index) => {
            const start = positions[connection.from],
              end = positions[connection.to];
            if (!start || !end) return null;
            const active =
              affected.includes(connection.from) ||
              affected.includes(connection.to);
            return (
              <g
                key={`${connection.from}-${connection.to}-${index}`}
                className={active ? "affected" : ""}
              >
                <path
                  d={`M ${start.x} ${start.y} C ${start.x} ${(start.y + end.y) / 2 + 35}, ${end.x} ${(start.y + end.y) / 2 - 35}, ${end.x} ${end.y}`}
                  fill="none"
                  markerEnd={`url(#arrow-${project.id})`}
                />
              </g>
            );
          })}
        </svg>
        <div className="operating-nodes">
          {project.components.map((item) => {
            const Icon = icons[item.kind];
            return (
              <button
                key={item.id}
                className={`${affected.includes(item.id) ? "affected" : ""} ${selected === item.id ? "selected" : ""}`}
                onClick={() =>
                  setSelected(selected === item.id ? null : item.id)
                }
                aria-label={`Inspect ${item.label}`}
                aria-pressed={selected === item.id}
              >
                <Icon size={20} />
                <strong>{item.label}</strong>
                <span>
                  {running && affected.includes(item.id)
                    ? "Applying change"
                    : item.kind === "data"
                      ? "State & records"
                      : item.kind === "control"
                        ? "Operational control"
                        : item.kind === "queue"
                          ? "Buffered work"
                          : item.kind === "client"
                            ? "User entry point"
                            : "Service boundary"}
                </span>
                <i />
              </button>
            );
          })}
        </div>
        {component && (
          <div className="operating-component">
            <button
              onClick={() => setSelected(null)}
              aria-label="Close component details"
            >
              <X size={14} />
            </button>
            <strong>{component.label}</strong>
            <p>{component.description}</p>
          </div>
        )}
      </div>
      <div className="operating-metrics">
        {(
          [
            ["availability", "Availability", "%"],
            ["risk", "Risk", "/100"],
            ["latency", "Response", "ms"],
            ["monthlyCost", "Monthly cost", "€"],
          ] as const
        ).map(([key, label, unit]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>
              {unit === "€" ? "€" : ""}
              {metrics[key].toLocaleString("en-GB", {
                maximumFractionDigits: key === "availability" ? 2 : 0,
              })}
              <small>{unit === "€" ? "" : unit}</small>
            </strong>
            {before && before[key] !== metrics[key] && (
              <em
                className={
                  (
                    key === "availability"
                      ? metrics[key] > before[key]
                      : metrics[key] < before[key]
                  )
                    ? "improved"
                    : "increased"
                }
              >
                {metrics[key] > before[key] ? "+" : ""}
                {Number((metrics[key] - before[key]).toFixed(2))}
                {unit === "€"
                  ? " €"
                  : unit === "ms"
                    ? " ms"
                    : key === "availability"
                      ? " pts"
                      : " points"}
              </em>
            )}
          </div>
        ))}
      </div>
      <footer>Modelled outcomes, not live telemetry or a cloud bill.</footer>
    </div>
  );
}

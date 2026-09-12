"use client";

import { useEffect, useId, useState } from "react";
import { ArrowUpRight, Play, RotateCcw } from "lucide-react";
import { initialSystem, type SystemState } from "@/lib/engine";

const components = [
  {
    name: "Customer portal",
    role: "01 / THE REQUEST",
    text: "A customer opens a claim. The browser sends an HTTP request to your gateway.",
  },
  {
    name: "API gateway",
    role: "02 / THE BOUNDARY",
    text: "Traffic enters here. Add TLS to protect it in transit; verify identity inside the application.",
  },
  {
    name: "Claims service",
    role: "03 / THE DECISION",
    text: "Your application validates the request and decides who can read or change a claim.",
  },
  {
    name: "Claims database",
    role: "04 / THE RECORD",
    text: "Claims persist here. Access controls and tested backups protect the customer’s record.",
  },
];

function Block({
  x,
  y,
  w,
  d,
  h,
  warm = false,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  warm?: boolean;
}) {
  return (
    <g
      stroke={warm ? "#903d28" : "#55594e"}
      strokeWidth="1.1"
      strokeLinejoin="round"
    >
      <path
        d={`M${x - d} ${y + d / 2 - h}L${x + w - d} ${y + (w + d) / 2 - h}V${y + (w + d) / 2}L${x - d} ${y + d / 2}Z`}
        fill={warm ? "#e47954" : "#b7b9a8"}
      />
      <path
        d={`M${x + w - d} ${y + (w + d) / 2 - h}L${x + w} ${y + w / 2 - h}V${y + w / 2}L${x + w - d} ${y + (w + d) / 2}Z`}
        fill={warm ? "#b44d32" : "#747c6b"}
      />
      <path
        d={`M${x} ${y - h}L${x + w} ${y + w / 2 - h}L${x + w - d} ${y + (w + d) / 2 - h}L${x - d} ${y + d / 2 - h}Z`}
        fill={warm ? "#f6b490" : "#e3e2ce"}
      />
    </g>
  );
}

export function ProjectModel({
  state = initialSystem,
  compact = false,
}: {
  state?: SystemState;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(2);
  const [step, setStep] = useState(-1);
  const pathId = useId().replace(/:/g, "");
  useEffect(() => {
    if (step < 0) return;
    const timer = setTimeout(() => {
      if (step < 3) {
        setStep(step + 1);
        setSelected(step + 1);
      } else setStep(-1);
    }, 950);
    return () => clearTimeout(timer);
  }, [step]);
  const replay = () => {
    setSelected(0);
    setStep(0);
  };
  const pick = (index: number) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `Explore ${components[index].name}`,
    "aria-pressed": selected === index,
    className: `model-part ${selected === index ? "selected" : ""}`,
    onClick: () => setSelected(index),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSelected(index);
      }
    },
  });
  return (
    <div
      className={`project-model ${compact ? "compact" : ""} ${step >= 0 ? "is-replaying" : ""}`}
    >
      <div className="model-caption">
        <span>
          <i /> SYSTEM STUDY / 001
        </span>
        <span>INTERACTIVE MODEL</span>
      </div>
      <svg
        className="model-drawing"
        viewBox="0 0 720 395"
        aria-label="Interactive model of the Northstar claims platform"
      >
        <defs>
          <pattern
            id={`${pathId}-grid`}
            width="48"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 12L24 0L48 12L24 24Z"
              fill="none"
              stroke="#989b87"
              strokeWidth=".5"
              opacity=".24"
            />
          </pattern>
          <path
            id={`${pathId}-route`}
            d="M158 265L220 296L318 247L385 280L440 252L502 283L585 241"
          />
        </defs>
        <path
          d="M45 238L395 63L703 217L353 392Z"
          fill={`url(#${pathId}-grid)`}
        />
        <path
          d="M45 238L395 63L703 217L353 392Z"
          fill="none"
          stroke="#b9bcaa"
          strokeWidth=".7"
        />
        <path
          d="M52 256L353 407M365 386L708 214"
          stroke="#c6c7b9"
          strokeDasharray="3 5"
          fill="none"
        />
        <use
          href={`#${pathId}-route`}
          fill="none"
          stroke="#969986"
          strokeWidth="6"
          opacity=".15"
        />
        <use
          href={`#${pathId}-route`}
          fill="none"
          stroke="#ae4b30"
          strokeWidth="1.7"
        />
        <path
          d="M439 252L506 218L425 178"
          fill="none"
          stroke="#8c947e"
          strokeDasharray="4 4"
        />
        {step >= 0 && (
          <circle className="model-packet" r="4" fill="#f16a3d">
            <animateMotion dur="3.8s" repeatCount="1">
              <mpath href={`#${pathId}-route`} />
            </animateMotion>
          </circle>
        )}
        <g {...pick(0)}>
          <ellipse
            className="model-selection"
            cx="151"
            cy="272"
            rx="64"
            ry="20"
          />
          <Block x={155} y={238} w={43} d={50} h={7} />
          <path d="M150 235V214L164 221V243" fill="#747c6b" stroke="#55594e" />
          <path
            d="M113 151L192 191V242L113 202Z"
            fill="#2e3834"
            stroke="#374138"
            strokeWidth="2"
          />
          <path d="M119 161L186 195V230L119 196Z" fill="#dae2c1" />
          <path
            d="M127 173L155 187M127 180L176 205M127 187L165 206"
            stroke="#6c8467"
            strokeWidth="2"
          />
          <path
            d="M113 151L121 147L200 186V237L192 242V191Z"
            fill="#a7af99"
            stroke="#55594e"
          />
          <text x="88" y="309" className="model-label">
            01 / PORTAL
          </text>
        </g>
        <g {...pick(1)}>
          <ellipse
            className="model-selection"
            cx="306"
            cy="252"
            rx="58"
            ry="18"
          />
          <Block x={307} y={205} w={47} d={48} h={11} />
          <Block x={307} y={189} w={47} d={48} h={11} />
          <Block x={307} y={173} w={47} d={48} h={11} />
          <path
            d="M304 170L317 176L306 182L295 176Z"
            fill={state.tls ? "#577557" : "#b74e31"}
          />
          <text x="244" y="297" className="model-label">
            02 / GATEWAY
          </text>
        </g>
        <g {...pick(2)}>
          <ellipse
            className="model-selection"
            cx="434"
            cy="253"
            rx="65"
            ry="19"
          />
          <Block x={436} y={185} w={61} d={69} h={138} warm />
          <path
            d="M376 99L419 121V215L376 194Z"
            fill="#3f4136"
            stroke="#843e2c"
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(0 ${i * 21})`}>
              <path
                d="M380 107L415 125V140L380 122Z"
                fill="#666752"
                stroke="#8a8a6b"
                strokeWidth=".6"
              />
              <path d="M384 114L398 121" stroke="#c7c3a0" strokeWidth="1.4" />
              <circle
                cx="410"
                cy="131"
                r="2"
                fill={state.healthy ? "#c6df7c" : "#ff7a60"}
              />
            </g>
          ))}
          <path
            d="M433 90L484 65M433 97L484 72M433 104L484 79"
            stroke="#91432d"
            strokeWidth="1"
            opacity=".45"
          />
          <text
            x="458"
            y="117"
            transform="rotate(-27 458 117)"
            fill="#ffd0b0"
            fontSize="9"
            fontFamily="monospace"
          >
            NS–001
          </text>
          <path
            d="M433 37V19H504"
            stroke="#8f735e"
            fill="none"
            strokeWidth=".8"
          />
          <text x="510" y="22" className="model-annotation">
            CLAIMS RUNTIME
          </text>
          <text x="358" y="309" className="model-label">
            03 / SERVICE
          </text>
        </g>
        <g {...pick(3)}>
          <ellipse
            className="model-selection"
            cx="583"
            cy="243"
            rx="53"
            ry="17"
          />
          <path
            d="M547 173V225C547 244 619 244 619 225V173"
            fill="#89917b"
            stroke="#555e50"
          />
          <path
            d="M547 190C547 209 619 209 619 190M547 208C547 227 619 227 619 208"
            fill="none"
            stroke="#d0d2b5"
          />
          <ellipse
            cx="583"
            cy="173"
            rx="36"
            ry="13"
            fill="#d5d9bc"
            stroke="#555e50"
          />
          <ellipse
            cx="583"
            cy="173"
            rx="26"
            ry="8"
            fill="none"
            stroke="#9aab89"
          />
          <path d="M554 183V224" stroke="#b9c0a2" strokeWidth="3" />
          <text x="545" y="283" className="model-label">
            04 / DATA
          </text>
        </g>
        <g className="model-scale">
          <path
            d="M64 352V338M64 345H130M130 338V352M97 342V348"
            stroke="#7e8472"
          />
          <text x="64" y="371">
            CONCEPTUAL / NOT TO SCALE
          </text>
        </g>
      </svg>
      <div className="model-details" aria-live="polite">
        <div>
          <span>{components[selected].role}</span>
          <strong>
            {components[selected].name} <ArrowUpRight size={15} />
          </strong>
          <p>{components[selected].text}</p>
        </div>
        <button
          className="model-replay"
          onClick={replay}
          disabled={step >= 0}
          aria-label="Replay simulated request"
        >
          {step >= 0 ? (
            <RotateCcw size={16} className="spin" />
          ) : (
            <Play size={16} />
          )}
          <span>{step >= 0 ? `Step ${step + 1} / 4` : "Trace a request"}</span>
        </button>
      </div>
    </div>
  );
}

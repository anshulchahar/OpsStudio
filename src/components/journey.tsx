"use client";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  Network,
  GitBranch,
  ShieldCheck,
  Activity,
  Layers,
  FlaskConical,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { chapters, missions } from "@/lib/curriculum";
export function Journey() {
  const { progress, update } = useStudio();
  const router = useRouter();
  return (
    <div className="page journey-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE FIELD GUIDE</div>
          <h1>
            TWENTY DECISIONS. <span>ONE SYSTEM.</span>
          </h1>
          <p>
            Build the claims platform from its first request to disaster
            recovery. Each mission leaves a change you can inspect.
          </p>
        </div>
        <div className="journey-total">
          <strong>
            {progress.completed.length}
            <span>/20</span>
          </strong>
          <small>missions completed</small>
        </div>
      </div>
      <div className="journey-banner">
        <span className="northstar-mark">✦</span>
        <div>
          <strong>Project 001 / Northstar Insurance</strong>
          <p>
            Follow one claims service from its first request to a resilient,
            secure system.
          </p>
        </div>
        <span className="small-tag">5 CONNECTED CHAPTERS</span>
      </div>
      <div className="journey-chapters">
        {chapters.map((chapter, index) => {
          const Icon = [Network, GitBranch, ShieldCheck, Activity, Layers][
            index
          ];
          return (
            <section
              key={chapter.title}
              className={`journey-chapter ${chapter.color}`}
            >
              <div className="chapter-rail">
                <span className={`chapter-icon ${chapter.color}`}>
                  <Icon size={23} />
                </span>
                <i />
              </div>
              <div className="journey-chapter-body">
                <div className="journey-chapter-heading">
                  <div>
                    <span className="eyebrow">
                      CHAPTER {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{chapter.title}</h2>
                    <p>{chapter.description}</p>
                  </div>
                  <span>
                    {
                      missions.filter(
                        (m) =>
                          m.chapter === index &&
                          progress.completed.includes(m.id),
                      ).length
                    }
                    /4 complete
                  </span>
                </div>
                <div className="journey-missions">
                  {missions
                    .filter((m) => m.chapter === index)
                    .map((m) => (
                      <button
                        key={m.id}
                        className={
                          progress.completed.includes(m.id) ? "completed" : ""
                        }
                        onClick={() => {
                          update((p) => ({
                            ...p,
                            activeMission: missions.indexOf(m),
                          }));
                          router.push("/studio");
                        }}
                      >
                        <span className="mission-circle">
                          {progress.completed.includes(m.id) ? (
                            <Check size={15} />
                          ) : (
                            String(missions.indexOf(m) + 1).padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <h3>{m.title}</h3>
                          <p>{m.subtitle}</p>
                        </div>
                        <span className="mission-time">
                          {m.lab && <FlaskConical size={14} />}
                          <Clock3 size={13} />
                          {m.duration} min
                        </span>
                        <ArrowRight size={17} />
                      </button>
                    ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="journey-note">
        <ShieldCheck size={20} />
        <p>
          <strong>Understanding grows through practice.</strong> Advanced
          chapters currently use simulations. Two foundational recipes also run
          real HTTP checks in isolated VMs. Completing a chapter is a learning
          milestone, not a professional certification.
        </p>
      </div>
    </div>
  );
}

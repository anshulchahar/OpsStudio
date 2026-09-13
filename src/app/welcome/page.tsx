import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Network,
  Sparkles,
  ShieldCheck,
  FlaskConical,
  Check,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Blueprint } from "@/components/overview";
import { projects } from "@/lib/projects";
const requestCount = projects.reduce(
  (total, project) => total + project.work.length,
  0,
);
export const metadata = {
  title: "Practice engineering across real-world domains",
  description:
    "Join fictional teams across commerce, healthcare, payments, AI, and infrastructure. Rehearse DevSecOps decisions, see their consequences, and build your engineering record.",
};
export default function Welcome() {
  return (
    <div className="landing">
      <nav>
        <Brand />
        <div>
          <Link href="/">Explore projects</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/" className="button primary small">
            Try the studio
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div className="eyebrow">
            <span className="status-dot" />
            DEVSECOPS / YOUR NEXT ENGINEERING TEAM
          </div>
          <h1>
            BUILD IT. BREAK IT.
            <br />
            <span>UNDERSTAND IT.</span>
          </h1>
          <p>
            A neighbourhood workshop. A payment company. An AI platform.
            <br />
            Join the team. Make the decisions. See what your choices change.
          </p>
          <div className="landing-actions">
            <Link href="/" className="button primary">
              Find your first project
              <ArrowRight size={17} />
            </Link>
            <Link href="/journey" className="button secondary">
              See what needs doing
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="landing-reassurance">
            <span>
              <Check size={13} />
              No code to type
            </span>
            <span>
              <Check size={13} />
              Start without an account
            </span>
            <span>
              <Check size={13} />
              Revisit every decision
            </span>
          </div>
          <div className="landing-preview">
            <div className="landing-preview-top">
              <span className="northstar-mark">✦</span>
              <strong>Northstar Insurance</strong>
              <span>
                ONE OF {projects.length} PROJECTS / THE CLAIMS PLATFORM
              </span>
            </div>
            <Blueprint />
            <div className="landing-preview-bottom">
              <span>
                <Network size={15} />
                Explore the map
              </span>
              <span>
                <Sparkles size={15} />
                Inspect a change
              </span>
              <span>
                <ShieldCheck size={15} />
                Understand the consequence
              </span>
            </div>
          </div>
          <div
            className="landing-project-range"
            aria-label="Explore the project collection"
          >
            {projects.map((project) => (
              <Link href={`/projects/${project.id}`} key={project.id}>
                <strong>{project.name}</strong>
                <span>{project.industry}</span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </section>
        <section className="landing-how">
          <div className="eyebrow">THE IDEA IS SIMPLE</div>
          <h2>The work is how you learn.</h2>
          <div>
            {[
              {
                n: "01",
                title: "Start with a problem.",
                text: "A booking fails. A payment arrives twice. A hospital needs a safe recovery plan. Your work starts with a teammate asking for something that matters.",
              },
              {
                n: "02",
                title: "Choose an approach. Rehearse it.",
                text: "OpsStudio handles the modeled implementation. Follow the affected systems, inspect the generated configuration, and see the operational consequences.",
              },
              {
                n: "03",
                title: "Make it better. Take on more.",
                text: "Compare the tradeoffs, revise a choice, and pick up another request. A small contextual hint or a Gemini conversation helps when you need a second perspective.",
              },
            ].map((item) => (
              <article key={item.n}>
                <span>{item.n}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-honesty">
          <FlaskConical size={27} />
          <div>
            <h2>Clear about what is real.</h2>
            <p>
              Explore {requestCount} team requests across {projects.length}{" "}
              fictional projects. The architecture, evidence, and measurements
              are modeled, so you can try different decisions without
              provisioning production systems. Account holders can ask Gemini
              for a tailored second perspective; routine rehearsals and hints
              use no AI credits.
            </p>
            <Link href="/" className="text-link">
              Explore the project shelf
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="landing-final">
          <h2>Every engineer starts somewhere.</h2>
          <p>
            Your first team is waiting. Start small and keep taking on more.
          </p>
          <Link href={`/projects/${projects[0].id}`} className="button primary">
            Join {projects[0].name}
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer>
        <Brand />
        <p>
          Built for curious engineers. Synthetic data. Independent of any
          employer.
        </p>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

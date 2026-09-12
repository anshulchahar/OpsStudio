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
export const metadata = {
  title: "Learn by bringing a system to life · OpsStudio",
  description:
    "An interactive DevSecOps workspace. Build a fictional insurance service, follow every change, and learn with a thoughtful AI teammate.",
};
export default function Welcome() {
  return (
    <div className="landing">
      <nav>
        <Brand />
        <div>
          <Link href="/journey">The learning path</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/studio" className="button primary small">
            Try the studio
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div className="eyebrow">
            <span className="status-dot" />
            DEVSECOPS / LEARN THROUGH ENGINEERING
          </div>
          <h1>
            BUILD IT. BREAK IT.
            <br />
            <span>UNDERSTAND IT.</span>
          </h1>
          <p>
            An interactive workbench for the engineer you’re becoming.
            <br />
            Make the decisions. Watch the system change. Inspect the evidence.
          </p>
          <div className="landing-actions">
            <Link href="/studio" className="button primary">
              Enter your workspace
              <ArrowRight size={17} />
            </Link>
            <Link href="/journey" className="button secondary">
              Explore the journey
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
              Learn at your own pace
            </span>
          </div>
          <div className="landing-preview">
            <div className="landing-preview-top">
              <span className="northstar-mark">✦</span>
              <strong>Northstar Insurance</strong>
              <span>PROJECT 001 / THE CLAIMS PLATFORM</span>
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
        </section>
        <section className="landing-how">
          <div className="eyebrow">THE IDEA IS SIMPLE</div>
          <h2>The work is how you learn.</h2>
          <div>
            {[
              {
                n: "01",
                title: "Start with a problem.",
                text: "A fictional insurer needs a claims service. Every mission starts with something a customer or engineering team needs.",
              },
              {
                n: "02",
                title: "Make a change. Follow its journey.",
                text: "Choose an action. Watch the architecture change, inspect the evidence, and explore what happens to a request.",
              },
              {
                n: "03",
                title: "Understand why. Then go further.",
                text: "Explain the tradeoff in your own mind. A small hint or a Gemini conversation helps you find your next step.",
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
              The beta has 20 interactive missions and two real Node.js
              verification recipes in disposable VMs. The architecture is a
              labelled simulation. Account holders can ask Gemini for tailored
              explanations; routine actions and hints use no AI credits.
            </p>
            <Link href="/journey" className="text-link">
              Explore all twenty missions
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="landing-final">
          <h2>Every engineer starts somewhere.</h2>
          <p>Your first request starts here.</p>
          <Link href="/studio" className="button primary">
            Let’s build an understanding
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

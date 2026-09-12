"use client";
import Link from "next/link";
import {
  Download,
  NotebookPen,
  Check,
  ArrowRight,
  FileText,
  History,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { missions } from "@/lib/curriculum";
export function Notebook() {
  const { progress, update, sync } = useStudio();
  function exportNotebook() {
    const report = `# My OpsStudio engineering notebook\n\nProject: Northstar Insurance (fictional)\nExported: ${new Date().toISOString()}\n\n## My reflections\n\n${progress.notes || "No notes yet."}\n\n## Completed missions\n\n${
      missions
        .filter((m) => progress.completed.includes(m.id))
        .map((m) => `- ${m.title}: ${m.decision.explanation}`)
        .join("\n") || "None yet."
    }\n\n## Current simulation state\n\n\`\`\`json\n${JSON.stringify(progress.state, null, 2)}\n\`\`\`\n\nThis record documents guided simulation exercises and learner decisions. AI and authored templates perform implementation steps. It is not a professional certification or proof of production work. Real lab results are exported separately.\n`;
    const url = URL.createObjectURL(
      new Blob([report], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-opsstudio-notebook.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="page notebook-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE WORKING RECORD</div>
          <h1>
            THE ENGINEERING <span>NOTEBOOK.</span>
          </h1>
          <p>
            The decisions you made. The connections you noticed. The questions
            worth keeping.
          </p>
        </div>
        <button className="button secondary" onClick={exportNotebook}>
          <Download size={16} />
          Export notebook
        </button>
      </div>
      <div className="notebook-grid">
        <section className="notes-editor">
          <header>
            <div>
              <NotebookPen size={19} />
              <h2>Decisions & observations</h2>
            </div>
            <span>{sync}</span>
          </header>
          <textarea
            aria-label="Your engineering notes"
            value={progress.notes}
            maxLength={20000}
            onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))}
            placeholder={
              'What clicked today?\n\nTry capturing a decision in your own words:\n"I chose ___ because ___. The tradeoff was ___. I would verify it by ___."\n\nOr leave a question for your future self.'
            }
          />
          <footer>
            <span>Just your words. Saved automatically.</span>
            <span>{progress.notes.length.toLocaleString()} / 20,000</span>
          </footer>
        </section>
        <aside className="notebook-sidebar">
          <section>
            <span className="soft-icon blue">
              <Check size={18} />
            </span>
            <h2>What you can explain</h2>
            <p>
              Completed missions and the engineering decisions you verified.
            </p>
            {progress.completed.length ? (
              missions
                .filter((m) => progress.completed.includes(m.id))
                .map((m) => (
                  <div className="learned-item" key={m.id}>
                    <Check size={14} />
                    <span>{m.title}</span>
                  </div>
                ))
            ) : (
              <div className="notebook-empty">
                <FileText size={26} />
                <span>Your completed missions will appear here.</span>
                <Link href="/studio">
                  Make a start
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>
          <section className="notebook-checkpoints">
            <History size={20} />
            <h3>{progress.checkpoints.length} saved checkpoints</h3>
            <p>
              Return to an earlier system state in the studio. Your reflections
              stay with you.
            </p>
            <Link href="/studio" className="text-link">
              Return to your system
              <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

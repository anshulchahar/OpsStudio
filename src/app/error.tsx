"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <span className="eyebrow">LET’S GET YOU BACK ON TRACK</span>
      <h1>This part of the workspace couldn’t load.</h1>
      <p>
        Your saved learning progress is separate from this page. Try loading it
        again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Sparkles, LoaderCircle } from "lucide-react";
import { useStudio } from "./app-provider";
export function Pricing({
  testMode,
  checkoutReady,
}: {
  testMode: boolean;
  checkoutReady: boolean;
}) {
  const { user, notify } = useStudio();
  const [busy, setBusy] = useState(false);
  async function checkout() {
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Checkout is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page pricing-page">
      <div className="pricing-heading">
        <span className="eyebrow">INVEST IN YOUR UNDERSTANDING</span>
        <h1>
          A place to start.
          <br />
          <span>Room to go further.</span>
        </h1>
        <p>
          Explore freely during early access. Help shape a better way to become
          an engineer.
        </p>
      </div>
      <div className="pricing-cards">
        <section>
          <span className="plan-label">EXPLORER</span>
          <h2>Find your footing.</h2>
          <div className="price">
            €0<span>during early access</span>
          </div>
          <p>A complete introduction to the way systems fit together.</p>
          <ul>
            {[
              "20 connected simulation missions",
              "Interactive system map and request explorer",
              "Progressive hints and decision checkpoints",
              "Your notebook and downloadable learning record",
              "Account access to metered mentor and verification labs",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          <Link href="/studio" className="button secondary">
            Start exploring
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="supporter-plan">
          <span className="supporter-label">
            <Sparkles size={13} />
            {testMode ? "CHECKOUT PREVIEW" : "SUPPORTER"}
          </span>
          <span className="plan-label">STUDIO SUPPORTER</span>
          <h2>Help build what’s next.</h2>
          <div className="price">
            €15<span>/ month{testMode ? " · test mode" : ""}</span>
          </div>
          <p>
            {testMode
              ? "Preview the subscription experience. Test mode does not charge real money."
              : "Support the development of deeper labs and new projects."}
          </p>
          <ul>
            {[
              "Everything available in Explorer",
              "Support the future of the studio",
              "Manage or cancel through Stripe",
              "No promise of unreleased features",
              "Same beta AI and lab allowances",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          {!user ? (
            <Link href="/login" className="button primary">
              Sign in to explore the plan
              <ArrowRight size={16} />
            </Link>
          ) : (
            <button
              className="button primary"
              disabled={busy || !checkoutReady}
              onClick={checkout}
            >
              {busy ? <LoaderCircle size={16} className="spin" /> : null}
              {checkoutReady
                ? testMode
                  ? "Preview test checkout"
                  : "Become a supporter"
                : "Checkout is being prepared"}
              <ArrowRight size={16} />
            </button>
          )}
        </section>
      </div>
      <p className="pricing-disclosure">
        {testMode
          ? "This release uses Stripe test mode. Do not enter real card details. Live subscriptions will open after the operator finishes the billing and business setup."
          : "Recurring monthly subscription. Review the final amount and applicable taxes in checkout before subscribing."}
      </p>
    </div>
  );
}

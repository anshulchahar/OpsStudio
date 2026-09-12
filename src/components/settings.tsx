"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ShieldCheck,
  LogOut,
  Sparkles,
  FlaskConical,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useStudio } from "./app-provider";
import { browserSupabase } from "@/lib/supabase/browser";
import { emptyProgress } from "@/lib/engine";
import { Dialog } from "./dialog";
type Account = {
  usage: { kind: string; used: number }[];
  limits: { mentor: number; lab: number };
  subscription: { status: string; live_mode: boolean } | null;
};
export function SettingsView() {
  const { user, update, notify, sync } = useStudio();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [reset, setReset] = useState(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (user)
      fetch("/api/account")
        .then(async (r) => {
          if (r.ok) setAccount(await r.json());
        })
        .catch(() => {});
  }, [user]);
  async function portal() {
    setWorking(true);
    try {
      const r = await fetch("/api/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.assign(d.url);
    } catch (e) {
      notify(e instanceof Error ? e.message : "The portal is unavailable.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR PACE</div>
          <h1>
            A few things <span>to make it yours.</span>
          </h1>
          <p>
            Manage your account, understand your allowances, and keep control of
            your progress.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>Your account</h2>
          <div className="settings-profile">
            <span className="avatar large">
              {user?.email?.slice(0, 1).toUpperCase() || "Y"}
            </span>
            <div>
              <strong>{user?.email || "You’re exploring as a guest"}</strong>
              <p>{sync}</p>
            </div>
          </div>
          {user ? (
            <button
              className="button secondary"
              onClick={async () => {
                const { error } = await browserSupabase()!.auth.signOut();
                if (error) {
                  notify("Sign-out failed. Please try again.");
                  return;
                }
                router.push("/");
                notify("You’re signed out.");
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          ) : (
            <Link href="/login" className="button primary">
              Save your journey with an account
              <ArrowUpRight size={15} />
            </Link>
          )}
        </section>
        <section className="settings-card">
          <h2>Thoughtful use of AI</h2>
          <p>
            Gemini runs only when you send a question. Guided hints, mission
            actions, and animations make no AI requests.
          </p>
          <div className="allowance">
            <Sparkles size={19} />
            <span>Mentor requests</span>
            <strong>
              {account
                ? `${account.usage.find((u) => u.kind === "mentor")?.used || 0} / ${account.limits.mentor}`
                : "8 maximum"}
              <small>per UTC day</small>
            </strong>
          </div>
          <div className="allowance">
            <FlaskConical size={19} />
            <span>Real verification labs</span>
            <strong>
              {account
                ? `${account.usage.find((u) => u.kind === "lab")?.used || 0} / ${account.limits.lab}`
                : "2 maximum"}
              <small>per UTC day</small>
            </strong>
          </div>
          <p className="settings-footnote">
            Shared platform ceilings also apply. An attempted provider request
            reserves allowance even if it fails. Saved answers can be reused
            without a new generation.
          </p>
        </section>
        <section className="settings-card">
          <h2>Your plan</h2>
          <span className="plan-label">
            {account?.subscription?.status === "active"
              ? `Supporter ${account.subscription.live_mode ? "" : "· test subscription"}`
              : "Early access · free"}
          </span>
          <p>
            The complete simulation journey is open during the beta. Explore the
            foundations and help shape what comes next.
          </p>
          <div className="button-row">
            <Link href="/pricing" className="button secondary">
              Explore plans
              <ArrowUpRight size={15} />
            </Link>
            {account?.subscription && (
              <button className="text-link" onClick={portal} disabled={working}>
                Manage subscription
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </section>
        <section className="settings-card">
          <h2>Your learning data</h2>
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <p>
              Your notebook and progress belong to your account. The fictional
              Northstar project uses synthetic data; do not paste employer
              credentials or customer records into your questions.
            </p>
          </div>
          <div className="button-row">
            <Link href="/notebook" className="button secondary">
              Export your notebook
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="text-link danger-text"
              onClick={() => setReset(true)}
            >
              Start fresh
              <RotateCcw size={14} />
            </button>
          </div>
          <Link href="/privacy" className="settings-policy-link">
            How your data is handled
            <ExternalLink size={12} />
          </Link>
        </section>
      </div>
      <Dialog
        open={reset}
        onClose={() => setReset(false)}
        title="Start this journey again?"
      >
        <p className="dialog-intro">
          This clears your mission progress, checkpoints, and notes in this
          workspace. Export your notebook first if you want to keep a copy. Your
          account and saved Gemini answers remain.
        </p>
        <div className="button-row">
          <button className="button secondary" onClick={() => setReset(false)}>
            Keep my progress
          </button>
          <button
            className="button danger"
            onClick={() => {
              update(() => emptyProgress);
              setReset(false);
              notify("Your workspace is ready for a fresh start.");
            }}
          >
            Clear my progress
          </button>
        </div>
      </Dialog>
    </div>
  );
}

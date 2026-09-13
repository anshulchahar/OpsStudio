"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Brand } from "./brand";
import { Blueprint } from "./overview";
import { browserSupabase } from "@/lib/supabase/browser";
export function AuthForm({
  signupEnabled = false,
}: {
  signupEnabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("message"))
      queueMicrotask(() => setMessage(params.get("message")!));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (mode === "signup" && !signupEnabled)) return;
    setBusy(true);
    setError("");
    setMessage("");
    const db = browserSupabase();
    if (!db) {
      setError(
        "Account service is not configured. You can continue as a guest.",
      );
      setBusy(false);
      return;
    }
    try {
      if (mode === "signin") {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/studio");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/studio");
          router.refresh();
        } else
          setMessage(
            "Check your email to confirm your account, then return here to sign in.",
          );
      } else {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/recovery`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists for this address, you’ll receive a recovery email.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sign-in could not finish. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">YOUR ENGINEERING WORKSPACE</span>
          <h1>
            BUILD THE SYSTEM.
            <br />
            KEEP THE EVIDENCE.
            <br />
            <span>KNOW THE WHY.</span>
          </h1>
          <p>
            A guided project. An AI engineering guide.
            <br />A little more understanding with every step.
          </p>
        </div>
        <Blueprint />
        <span className="auth-story-footer">BUILT FOR CURIOUS MINDS.</span>
      </div>
      <div className="auth-form-area">
        <Link href="/" className="auth-back">
          <ArrowLeft size={16} />
          Back to your workspace
        </Link>
        <div className="auth-form-card">
          <span className="soft-icon blue">
            <ShieldCheck size={23} />
          </span>
          <h2>
            {mode === "signup"
              ? "Make the journey yours."
              : mode === "reset"
                ? "Find your way back."
                : "Welcome back."}
          </h2>
          <p>
            {mode === "signup"
              ? "Create an account to save your progress and meet your AI teammate."
              : mode === "reset"
                ? "We’ll send a secure recovery link to your email."
                : "Pick up your discoveries right where you left them."}
          </p>
          {mode !== "reset" && (
            <div className="auth-tabs">
              <button
                className={mode === "signin" ? "selected" : ""}
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setMessage("");
                }}
              >
                Sign in
              </button>
              <button
                className={mode === "signup" ? "selected" : ""}
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
              >
                Create account
              </button>
            </div>
          )}
          {mode === "signup" && !signupEnabled ? (
            <div className="signup-pending">
              <h3>Public accounts are opening soon.</h3>
              <p>
                Public registration is not enabled for this beta. You can
                explore every project and save progress on this device
                right now.
              </p>
              <Link href="/studio" className="button primary">
                Explore as a guest
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {mode !== "reset" && (
                <>
                  <div className="password-label">
                    <label htmlFor="password">Password</label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("reset")}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={mode === "signup" ? 10 : 1}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "signup"
                        ? "At least 10 characters"
                        : "Your password"
                    }
                  />
                </>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="inline-success" role="status">
                  <Check size={16} />
                  {message}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : null}
                {mode === "signup"
                  ? "Create your account"
                  : mode === "reset"
                    ? "Send recovery link"
                    : "Enter your workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {mode === "reset" && (
            <button className="text-link" onClick={() => setMode("signin")}>
              Return to sign in
            </button>
          )}
          <div className="auth-guest">
            <span>Just looking around?</span>
            <Link href="/studio">
              Continue as a guest
              <ArrowUpRightIcon />
            </Link>
          </div>
          <p className="auth-privacy">
            Use synthetic learning data only.{" "}
            <Link href="/privacy">Read how your data is handled.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={13} style={{ transform: "rotate(-45deg)" }} />;
}

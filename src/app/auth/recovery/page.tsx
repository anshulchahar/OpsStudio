"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
import { Brand } from "@/components/brand";
import Link from "next/link";
export default function Recovery() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const db = browserSupabase();
    const code = new URLSearchParams(window.location.search).get("code");
    if (db && code)
      db.auth.exchangeCodeForSession(code).then(({ error }) => {
        setReady(!error);
        if (error)
          setMessage(
            "This recovery link has expired. Request another one from the sign-in screen.",
          );
      });
    else db?.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, []);
  return (
    <main className="standalone-page">
      <Brand />
      <section className="auth-form-card">
        <h1>Choose a new password.</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await browserSupabase()!.auth.updateUser({
              password,
            });
            setMessage(
              error
                ? error.message
                : "Your password has been updated. You can return to your workspace.",
            );
          }}
        >
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            minLength={10}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button primary" disabled={!ready}>
            Save new password
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        <Link href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}

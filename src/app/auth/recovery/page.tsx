"use client";
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
import { Brand } from "@/components/brand";
import Link from "next/link";

export default function Recovery() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const verifiedUser = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const db = browserSupabase();
    void (async () => {
      try {
        if (!db) throw new Error("Account recovery is temporarily unavailable.");
        // The shared browser client handles a recovery URL exactly once during
        // initialization. A second manual exchange consumes an already-used code.
        const { error: initializationError } = await db.auth.initialize();
        if (initializationError) throw initializationError;
        const { data, error } = await db.auth.getUser();
        if (error || !data.user) throw new Error("This recovery link has expired. Request another one from the sign-in screen.");
        if (active) { verifiedUser.current = data.user.id; setReady(true); }
      } catch {
        if (active) setMessage("This recovery link could not be verified. Request another one from the sign-in screen.");
      }
    })();
    const subscription = db?.auth.onAuthStateChange((_event, session) => {
      if (active && verifiedUser.current && session?.user.id !== verifiedUser.current) {
        verifiedUser.current = null;
        setReady(false);
        setMessage("Your signed-in account changed. Request a recovery link for the account you want to update.");
      }
    });
    return () => { active = false; mounted.current = false; subscription?.data.subscription.unsubscribe(); };
  }, []);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    const db = browserSupabase();
    const expectedUserId = verifiedUser.current;
    if (!db || !expectedUserId) return;
    setBusy(true); setMessage("");
    try {
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError || data.session?.user.id !== expectedUserId || verifiedUser.current !== expectedUserId) throw new Error("Your signed-in account changed. Request a recovery link for the account you want to update.");
      const response = await fetch("/api/account/password", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ expectedUserId, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The password update could not finish. Please try again.");
      if (result.userId !== expectedUserId) throw new Error("The password response did not match the intended account.");
      if (mounted.current && verifiedUser.current === expectedUserId) {
        setMessage("Your password has been updated. You can return to your workspace.");
        setPassword("");
        setReady(false);
      }
    } catch (error) {
      if (mounted.current && verifiedUser.current === expectedUserId) setMessage(error instanceof Error ? error.message : "The password update could not finish. Please try again.");
    } finally { if (mounted.current) setBusy(false); }
  }

  return <main className="standalone-page"><Brand /><section className="auth-form-card">
    <h1>Choose a new password.</h1>
    <form onSubmit={savePassword}>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" type="password" minLength={10} maxLength={1024} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={!ready || busy} />
      <button className="button primary" disabled={!ready || busy}>{busy ? "Saving password…" : "Save new password"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <Link href="/login">Return to sign in</Link>
  </section></main>;
}

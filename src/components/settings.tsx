"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ShieldCheck, LogOut, Sparkles, FlaskConical, RotateCcw, ExternalLink, Download, Trash2, LoaderCircle } from "lucide-react";
import { useStudio } from "./app-provider";
import { browserSupabase } from "@/lib/supabase/browser";
import { emptyProgress } from "@/lib/engine";
import { Dialog } from "./dialog";
import styles from "./account-settings.module.css";

type Account = {
  userId: string;
  usage: { kind: string; used: number }[];
  limits: { mentor: number; lab: number };
  subscription: { status: string; live_mode: boolean } | null;
};

export function SettingsView() {
  const { principalId, ready } = useStudio();
  if (!ready) return <div className="page settings-page" role="status"><LoaderCircle size={20} className="spin" /> Restoring your account…</div>;
  return <SettingsForPrincipal key={principalId} />;
}

function SettingsForPrincipal() {
  const { user, principalId, clearLocalData, update, notify, sync, ready } = useStudio();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState("");
  const [reset, setReset] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [working, setWorking] = useState(false);
  const [removeDeviceCopy, setRemoveDeviceCopy] = useState(sync === "Synced to your account");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cancelSubscriptions, setCancelSubscriptions] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch(`/api/account?expectedUserId=${encodeURIComponent(user.id)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Account details are temporarily unavailable.");
        const result = await response.json();
        if (result.userId !== user.id) throw new Error("Your signed-in account changed. Reload your settings.");
        if (mounted.current && !controller.signal.aborted) setAccount(result);
      })
      .catch(error => { if (!controller.signal.aborted && mounted.current) setAccountError(error instanceof Error ? error.message : "Could not load account details."); });
    return () => controller.abort();
  }, [user]);

  async function signOut() {
    const capturedId = principalId;
    setWorking(true);
    try {
      let localRemoved = false;
      if (removeDeviceCopy) {
        try { await clearLocalData(capturedId); localRemoved = true; }
        catch { /* Account sign-out still proceeds if this browser cannot clear storage. */ }
      }
      if (!mounted.current) return;
      const { error } = await browserSupabase()!.auth.signOut({ scope: "local" });
      if (error) throw new Error("Sign-out could not finish. Please try again.");
      router.push("/");
      notify(removeDeviceCopy ? (localRemoved ? "Signed out. This account’s device copy was removed." : "Signed out, but this browser could not remove the device copy. Clear site storage on this device to finish removal.") : "Signed out. This account’s work remains saved on this device.");
    } catch (error) {
      if (mounted.current) notify(error instanceof Error ? error.message : "Sign-out could not finish.");
    } finally { if (mounted.current) setWorking(false); }
  }
  async function portal() {
    setWorking(true);
    try {
      const response = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The portal is unavailable.");
      if (mounted.current) window.location.assign(result.url);
    } catch (error) { if (mounted.current) notify(error instanceof Error ? error.message : "The portal is unavailable."); }
    finally { if (mounted.current) setWorking(false); }
  }
  async function exportAccount() {
    if (!user) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/account?export=1&expectedUserId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Your export could not be prepared."); }
      const blob = await response.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "opsstudio-account-data.json.gz"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Your stored account data was exported as a compressed JSON file (.json.gz).");
    } catch (error) { if (mounted.current) notify(error instanceof Error ? error.message : "Your export could not be prepared."); }
    finally { if (mounted.current) setWorking(false); }
  }
  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!user || working || confirmation !== "DELETE" || !password) return;
    const capturedId = principalId;
    setWorking(true); setDeleteError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation, password, cancelSubscriptions, expectedUserId: user.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account deletion did not finish. No successful deletion is claimed.");
      let localRemoved = true;
      try { await clearLocalData(capturedId); } catch { localRemoved = false; }
      if (!mounted.current) return;
      // The server has revoked sessions and removed the user; clear the browser's Auth cache too.
      try { await browserSupabase()?.auth.signOut({ scope: "local" }); } catch { /* The server already revoked this removed account. */ }
      router.replace("/"); router.refresh();
      notify(localRemoved ? "Your account and its application records were deleted." : "Your account was deleted, but this browser could not clear its device copy. Clear site storage on this device to finish removal.");
    } catch (error) { if (mounted.current) setDeleteError(error instanceof Error ? error.message : "Account deletion did not finish. Please try again."); }
    finally { if (mounted.current) { setPassword(""); setWorking(false); } }
  }

  return <div className="page settings-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE, YOUR PACE</div><h1>A few things <span>to make it yours.</span></h1><p>Manage your account, understand your allowances, and keep control of your work.</p></div></div>
    <div className="settings-grid">
      <section className="settings-card"><h2>Your account</h2><div className="settings-profile"><span className="avatar large">{user?.email?.slice(0, 1).toUpperCase() || "Y"}</span><div><strong>{user?.email || "You’re exploring as a guest"}</strong><p>{sync}</p></div></div>
        {user ? <><label className={styles.checkbox}><input type="checkbox" checked={removeDeviceCopy} onChange={event => setRemoveDeviceCopy(event.target.checked)} disabled={working} /><span>Remove this account’s saved work from this device when signing out. Its last successfully synced cloud record stays available.</span></label>{removeDeviceCopy && sync !== "Synced to your account" && <p className="inline-error" role="status">Your latest work may not be synced. Export your engineering notebook first, or uncheck removal to keep this device’s copy.</p>}<button className="button secondary" onClick={signOut} disabled={working}><LogOut size={15} />Sign out</button></> : <Link href="/login" className="button primary">Save your projects with an account<ArrowUpRight size={15} /></Link>}
      </section>
      <section className="settings-card"><h2>Thoughtful use of AI</h2><p>Gemini runs only when you send a question. Contextual hints, rehearsals, and animations make no AI requests.</p>
        <div className="allowance"><Sparkles size={19} /><span>Mentor requests</span><strong>{account ? `${account.usage.find(item => item.kind === "mentor")?.used || 0} / ${account.limits.mentor}` : "8 maximum"}<small>per UTC day</small></strong></div>
        <div className="allowance"><FlaskConical size={19} /><span>Real verification labs</span><strong>{account ? `${account.usage.find(item => item.kind === "lab")?.used || 0} / ${account.limits.lab}` : "2 maximum"}<small>per UTC day</small></strong></div>
        {accountError && <p className="inline-error" role="status">{accountError}</p>}<p className="settings-footnote">Shared platform ceilings also apply. A reserved attempt can consume allowance even if it fails. Saved answers can be reused without a new generation.</p>
      </section>
      <section className="settings-card"><h2>Your plan</h2><span className="plan-label">{account?.subscription?.status === "active" ? `Supporter ${account.subscription.live_mode ? "" : "· test subscription"}` : "Early access · free"}</span><p>Every practice project is open during the beta. Try different industries and help shape what comes next.</p><div className="button-row"><Link href="/pricing" className="button secondary">Explore plans<ArrowUpRight size={15} /></Link>{account?.subscription && <button className="text-link" onClick={portal} disabled={working}>Manage subscription<ExternalLink size={14} /></button>}</div></section>
      <section className="settings-card"><h2>Your project records</h2><div className="privacy-note"><ShieldCheck size={22} /><p>Your notes and project records stay on this device and sync when signed in. Use synthetic company data and keep employer credentials and customer records out of questions.</p></div><div className="button-row"><Link href="/notebook" className="button secondary">Export engineering record<ArrowUpRight size={15} /></Link><button className="text-link danger-text" disabled={!ready || working} onClick={() => setReset(true)}>Start fresh<RotateCcw size={14} /></button></div><Link href="/privacy" className="settings-policy-link">How your data is handled<ExternalLink size={12} /></Link></section>
      {user && <section className="settings-card"><h2>Your data and account</h2><p>Download your stored account data, including saved AI answers and lab results. Permanent deletion removes the account and its application records after password and billing checks.</p><div className="button-row"><button className="button secondary" disabled={working} onClick={exportAccount}><Download size={15} />Export account data</button><button className="text-link danger-text" disabled={working} onClick={() => { setDeleting(true); setDeleteError(""); setPassword(""); setConfirmation(""); setCancelSubscriptions(false); }}><Trash2 size={14} />Delete account</button></div><p className="settings-footnote">Provider financial records and backups can have separate retention periods. <Link href="/privacy">Read the deletion and retention details.</Link></p></section>}
    </div>
    <p className="settings-policy-link"><Link href="/operator">Operator information</Link> · <Link href="/terms">Service terms</Link> · <Link href="/privacy">Privacy</Link></p>
    <Dialog open={reset} onClose={() => setReset(false)} title="Clear all project records?"><p className="dialog-intro">This clears every project’s decisions and change history, your notes, and earlier Northstar work and checkpoints. If signed in, the reset syncs to your account. Export first if you want a copy. Your account and saved Gemini answers remain.</p><div className="button-row"><button className="button secondary" onClick={() => setReset(false)}>Keep my records</button><button className="button danger" disabled={!ready} onClick={() => { if (!ready) return; update(() => structuredClone(emptyProgress)); setReset(false); notify("Your workspace is ready for a fresh start."); }}>Clear all project records</button></div></Dialog>
    <Dialog open={deleting} onClose={() => { if (!working) { setDeleting(false); setPassword(""); } }} title="Permanently delete your account?">
      <p className="dialog-intro">This removes your sign-in, saved project records and notes, AI questions and answers, lab results, and personal usage records. Export anything you want to keep first. This cannot be undone.</p>
      <form className={styles.form} onSubmit={deleteAccount}>
        <label htmlFor="deletion-password">Confirm your current password</label><input id="deletion-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={1024} disabled={working} />
        <label htmlFor="deletion-confirmation">Type DELETE to confirm</label><input id="deletion-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required disabled={working} />
        <label className={styles.checkbox}><input type="checkbox" checked={cancelSubscriptions} onChange={event => setCancelSubscriptions(event.target.checked)} disabled={working} /><span>If any subscriptions remain, cancel them immediately as part of deleting my account. This does not automatically refund previous payments.</span></label>
        <p className="settings-footnote">If you leave this unchecked, active billing will stop deletion and you can manage it first. Uncertain checkout operations must be resolved before deletion can finish.</p>
        {deleteError && <p className="inline-error" role="alert">{deleteError}</p>}
        <div className="button-row"><button type="button" className="button secondary" disabled={working} onClick={() => { setDeleting(false); setPassword(""); }}>Keep account</button><button className="button danger" disabled={working || confirmation !== "DELETE" || !password}>{working ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}Delete my account</button></div>
      </form>
    </Dialog>
  </div>;
}

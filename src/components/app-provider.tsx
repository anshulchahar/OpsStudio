"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { emptyProgress, savedProgressSchema, type SavedProgress } from "@/lib/engine";
import { browserSupabase } from "@/lib/supabase/browser";
import { changeDeviceRecord, deleteDeviceRecord, DeviceRecordRemovedError, readDeviceRecord } from "@/lib/device-progress";
import { acknowledgeRemote, assertProgressSize, integrateLocal, integrateRemote, resolveSyncConflict, sameProgress, type DeviceRecord, type SyncConflict } from "@/lib/progress-sync";
import { MotionConfig } from "motion/react";
import { Dialog } from "./dialog";

type Context = {
  progress: SavedProgress;
  update: (fn: (value: SavedProgress) => SavedProgress) => void;
  user: User | null;
  principalId: string;
  clearLocalData: (capturedPrincipalId: string) => Promise<void>;
  ready: boolean;
  sync: string;
  notify: (message: string) => void;
  toast: string;
};
const StudioContext = createContext<Context | null>(null);
export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("Studio provider missing");
  return value;
}

type Session = {
  id: string; user: User | null; record: DeviceRecord; queue: Promise<unknown>;
  pending: number; stopped: boolean; syncing: boolean; again: boolean; retries: number;
  intents: { id: string; base: SavedProgress; proposed: SavedProgress }[];
  controller?: AbortController; timer?: ReturnType<typeof setTimeout>;
};
type Actions = {
  update: Context["update"]; clear: Context["clearLocalData"];
  resolve: (id: string, choice: "local" | "remote" | "both") => void;
  retry: () => void;
};
const unavailable = () => { throw new Error("Your saved work is still loading. Please try again in a moment."); };

export function AppProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<SavedProgress>(emptyProgress);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState("Loading your saved work…");
  const [toast, setToast] = useState("");
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const actions = useRef<Actions>({ update: unavailable, clear: async () => unavailable(), resolve: unavailable, retry: unavailable });

  useEffect(() => {
    const db = browserSupabase();
    let disposed = false;
    let generation = 0;
    let authEvents = 0;
    let current: Session | undefined;
    let loadingId: string | undefined;
    let lastUser: User | null = null;
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("opsstudio-progress-v2");
    const active = (session: Session) => !disposed && current === session && !session.stopped;
    function stop(session?: Session) {
      if (!session) return;
      session.stopped = true;
      session.controller?.abort();
      clearTimeout(session.timer);
      if (session.intents.length && !disposed) {
        session.timer = setTimeout(() => {
          if (session.intents.length) void transaction(session, (record) => record, true, true).catch(() => undefined);
        }, 1000);
      }
    }
    function announce(session: Session, type = "changed") {
      if (disposed) return;
      const message = { principalId: session.id, type, nonce: crypto.randomUUID() };
      channel?.postMessage(message);
      // Fallback for browsers without BroadcastChannel. This carries no notes or account content.
      try { localStorage.setItem("opsstudio:progress-notify", JSON.stringify(message)); } catch { /* IndexedDB remains authoritative. */ }
    }
    function show(session: Session, record: DeviceRecord) {
      if (!active(session)) return;
      session.record = record;
      setProgress(record.draft);
      setConflicts(record.conflicts);
      if (record.conflicts.length) {
        setSync("Saved on this device · resolve conflicting edits");
        setConflictOpen(true);
      } else if (!session.user) setSync("Saved on this device");
    }
    function transaction(session: Session, transform: (record: DeviceRecord) => DeviceRecord, broadcast = true, persistWhenStopped = false) {
      session.pending++;
      const expectedEpoch = session.record.localEpoch;
      const job = session.queue.catch(() => undefined).then(async () => {
        if (!persistWhenStopped && !active(session)) return session.record;
        // Keep accepted edit intent until the transaction commits. In particular,
        // a failed optimistic note must not become the base for a later disk merge.
        const intents = session.intents.slice();
        const result = await changeDeviceRecord(session.id, (record) => {
          if (!active(session) && !persistWhenStopped) return record;
          let next = record;
          for (const intent of intents) next = integrateLocal(next, intent.base, intent.proposed);
          return transform(next);
        }, expectedEpoch);
        const accepted = new Set(intents.map((intent) => intent.id));
        session.intents = session.intents.filter((intent) => !accepted.has(intent.id));
        if (broadcast) announce(session);
        return result;
      });
      session.queue = job;
      void job.then((record) => {
        session.pending--;
        if (active(session) && session.pending === 0) {
          if (!session.intents.length) setSaveError("");
          show(session, record);
        }
      }, (error) => {
        session.pending--;
        if (active(session)) {
          if (error instanceof DeviceRecordRemovedError) {
            session.intents = [];
            stop(session);
            setReady(false);
            setProgress(structuredClone(emptyProgress));
            setConflicts([]);
            setSync(error.message);
            return;
          }
          setSync("Device save failed · keep this tab open and export your record");
          setSaveError("Your latest edits have not reached device storage. Keep this tab open while saving retries, or export your record.");
          setToast(error instanceof Error ? error.message : "Device storage could not save this change.");
          if (session.intents.length) schedule(session, 1000);
        } else if (session.intents.length && !(error instanceof DeviceRecordRemovedError) && !disposed) {
          // Signout may happen while an accepted device write is pending. Retry
          // only that captured principal; a removal tombstone still fences it.
          session.timer = setTimeout(() => {
            void transaction(session, (record) => record, true, true).catch(() => undefined);
          }, Math.min(30000, 1000 * 2 ** Math.min(session.retries++, 5)));
        }
      });
      return job;
    }
    function schedule(session: Session, delay = 700) {
      if (!active(session) || (!session.user && !session.intents.length)) return;
      clearTimeout(session.timer);
      session.timer = setTimeout(() => void synchronize(session), delay);
    }
    function decode(body: unknown, session: Session) {
      const value = body as { userId?: string; revision?: number; progress?: unknown };
      if (value?.userId !== session.id || !Number.isSafeInteger(value.revision) || value.revision! < 0) throw new Error("Progress response did not match this account.");
      return { progress: value.progress === null ? structuredClone(emptyProgress) : savedProgressSchema.parse(value.progress), revision: value.revision! };
    }
    async function synchronize(session: Session) {
      if (!active(session) || (!session.user && !session.intents.length)) return;
      if (session.syncing) { session.again = true; return; }
      session.syncing = true;
      session.again = false;
      const controller = new AbortController();
      session.controller = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      let retry = false;
      try {
        await session.queue.catch(() => undefined);
        if (!active(session)) return;
        if (session.intents.length) await transaction(session, (record) => record, true, true);
        if (!active(session)) return;
        if (!session.user) { setSync("Saved on this device"); session.retries = 0; return; }
        setSync("Saved on this device · checking account…");
        const response = await fetch("/api/progress", { headers: { "x-opsstudio-principal": session.id }, cache: "no-store", signal: controller.signal });
        if (!active(session)) return;
        if (response.status === 401 || response.status === 403) {
          setSync("Saved on this device · sign in again to sync");
          return;
        }
        if (!response.ok) throw new Error("Cloud sync unavailable");
        const remote = decode(await response.json(), session);
        let record = await transaction(session, (latest) => integrateRemote(latest, remote.progress, remote.revision));
        for (let attempt = 0; attempt < 3 && active(session); attempt++) {
          await session.queue;
          if (!active(session)) return;
          record = await transaction(session, (latest) => latest, false);
          if (record.conflicts.length) return;
          if (sameProgress(record.base, record.draft)) {
            setSync("Synced to your account");
            session.retries = 0;
            return;
          }
          const sent = structuredClone(record.draft);
          const saved = await fetch("/api/progress", {
            method: "PUT", headers: { "content-type": "application/json" },
            body: JSON.stringify({ expectedUserId: session.id, expectedRevision: record.revision, progress: sent }), signal: controller.signal,
          });
          if (!active(session)) return;
          if (saved.status === 401 || saved.status === 403) {
            setSync("Saved on this device · sign in again to sync");
            return;
          }
          if (!saved.ok && saved.status !== 409) throw new Error("Cloud save unavailable");
          const reply = decode(await saved.json(), session);
          record = await transaction(session, (latest) => saved.ok
            ? acknowledgeRemote(latest, sent, reply.progress, reply.revision)
            : integrateRemote(latest, reply.progress, reply.revision));
        }
        retry = active(session) && !record.conflicts.length;
      } catch {
        if (active(session)) {
          setSync(session.intents.length ? "Device save failed · retrying" : "Saved on this device · waiting to sync");
          retry = true;
        }
      } finally {
        clearTimeout(timeout);
        session.syncing = false;
        if (active(session) && (retry || session.again)) {
          schedule(session, session.again ? 200 : Math.min(30000, 1000 * 2 ** Math.min(session.retries++, 5)));
        }
      }
    }
    async function load(nextUser: User | null, force = false) {
      lastUser = nextUser;
      const id = nextUser?.id ?? "guest";
      if (!force && (loadingId === id || (current?.id === id && !current.stopped))) {
        if (current) schedule(current, 0);
        return;
      }
      loadingId = id;
      const ticket = ++generation;
      stop(current);
      current = undefined;
      setReady(false);
      setUser(nextUser);
      setProgress(structuredClone(emptyProgress));
      setConflicts([]);
      setConflictOpen(false);
      setSaveError("");
      setSync("Loading your saved work…");
      try {
        const record = await readDeviceRecord(id);
        if (disposed || ticket !== generation) return;
        const session: Session = { id, user: nextUser, record, queue: Promise.resolve(), pending: 0, stopped: false, syncing: false, again: false, retries: 0, intents: [] };
        current = session;
        loadingId = undefined;
        show(session, record);
        setReady(true);
        schedule(session, 0);
      } catch {
        if (disposed || ticket !== generation) return;
        loadingId = undefined;
        setSync("Device storage is unavailable. Enable site storage and retry.");
      }
    }
    actions.current = {
      update(fn) {
        const session = current;
        if (!session || !active(session)) return unavailable();
        const base = structuredClone(session.record.draft);
        const proposed = savedProgressSchema.parse(fn(structuredClone(base)));
        const blank = { ...proposed, resetId: emptyProgress.resetId, updatedAt: emptyProgress.updatedAt };
        if (sameProgress(blank, emptyProgress) && !sameProgress(base, proposed)) proposed.resetId = crypto.randomUUID();
        proposed.updatedAt = new Date().toISOString();
        assertProgressSize(proposed);
        session.intents.push({ id: crypto.randomUUID(), base, proposed });
        session.record = { ...session.record, draft: proposed };
        setProgress(proposed);
        setSync("Saving on this device…");
        void transaction(session, (record) => record, true, true).then(() => schedule(session), () => undefined);
      },
      async clear(id) {
        const session = current;
        if (session?.id === id) {
          stop(session);
          await session.queue.catch(() => undefined);
        }
        await deleteDeviceRecord(id);
        if (session?.id === id && current === session && !disposed) {
          setProgress(structuredClone(emptyProgress));
          setConflicts([]);
          setConflictOpen(false);
          setSaveError("");
          setSync("Local record removed");
          announce(session, "forgotten");
        }
      },
      resolve(id, choice) {
        const session = current;
        if (!session || !active(session)) return;
        void transaction(session, (record) => resolveSyncConflict(record, id, choice), true, true).then(() => schedule(session, 0), () => undefined);
      },
      retry() {
        if (current && active(current)) {
          const session = current;
          void transaction(session, (record) => record, true, true).then(() => schedule(session, 0), () => undefined);
        } else void load(lastUser, true);
      },
    };
    async function receive(message: unknown) {
      const event = message as { principalId?: string; type?: string };
      const session = current;
      if (!session || !active(session) || event.principalId !== session.id) return;
      if (event.type === "forgotten") {
        stop(session);
        setProgress(structuredClone(emptyProgress));
        setConflicts([]);
        setReady(false);
        setSync("This device record was removed in another tab. Reload to continue.");
        return;
      }
      await transaction(session, (record) => record, false).catch(() => undefined);
      if (active(session) && !sameProgress(session.record.base, session.record.draft)) schedule(session);
    }
    if (channel) channel.onmessage = (event) => void receive(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "opsstudio:progress-notify" || !event.newValue) return;
      try { void receive(JSON.parse(event.newValue)); } catch { /* Not a progress event. */ }
    };
    const reconnect = () => { if (current && active(current) && document.visibilityState !== "hidden") schedule(current, 0); };
    const leaving = (event: BeforeUnloadEvent) => {
      if (current?.pending || current?.intents.length) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    window.addEventListener("beforeunload", leaving);
    let unsubscribe: (() => void) | undefined;
    if (db) {
      const snapshot = authEvents;
      void db.auth.getUser().then(({ data: { user: nextUser } }) => {
        if (!disposed && snapshot === authEvents) void load(nextUser);
      }, () => { if (!disposed && snapshot === authEvents) void load(null); });
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        authEvents++;
        queueMicrotask(() => { if (!disposed) void load(session?.user ?? null); });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } else queueMicrotask(() => void load(null));
    return () => {
      disposed = true;
      generation++;
      stop(current);
      unsubscribe?.();
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
      document.removeEventListener("visibilitychange", reconnect);
      window.removeEventListener("beforeunload", leaving);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const conflict = conflicts[0];
  function describe(value: unknown) {
    if (typeof value === "string") return value || "(empty notes)";
    if (value && typeof value === "object" && "optionId" in value) return String((value as { snapshot?: { option: { title: string } }; optionId: string }).snapshot?.option.title ?? (value as { optionId: string }).optionId);
    if (value && typeof value === "object" && "portfolio" in value) {
      const record = value as SavedProgress;
      return `${Object.keys(record.portfolio.runs).length} projects · ${record.notes.length} note characters`;
    }
    if (value && typeof value === "object" && "selections" in value) {
      const run = value as { selections: Record<string, string>; applied: Record<string, { option: { title: string } }> };
      return Object.entries(run.selections).map(([id, optionId]) => run.applied[id]?.option.title ?? optionId).join("\n") || "No applied decisions";
    }
    return value === undefined ? "No applied decision" : JSON.stringify(value);
  }
  return (
    <StudioContext.Provider value={{ progress, update: (fn) => actions.current.update(fn), user, principalId: user?.id ?? "guest", clearLocalData: (id) => actions.current.clear(id), ready, sync, notify: setToast, toast }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      {saveError && ready && <div className="sync-conflict-banner" role="alert"><span>{saveError}</span><button className="button primary small" onClick={() => actions.current.retry()}>Retry saving</button></div>}
      {conflicts.length > 0 && !saveError && <div className="sync-conflict-banner" role="status"><span>Your work is safe on this device. {conflicts.length} conflicting edit{conflicts.length === 1 ? "" : "s"} need a choice.</span><button className="button primary small" onClick={() => setConflictOpen(true)}>Review saved versions</button></div>}
      {!ready && sync !== "Loading your saved work…" && <div className="sync-conflict-banner" role="alert"><span>{sync}</span><button className="button primary small" onClick={() => actions.current.retry()}>Retry</button></div>}
      <Dialog open={Boolean(conflict && conflictOpen)} onClose={() => setConflictOpen(false)} title="Keep the work you intended">
        {conflict && <><p>{conflict.title}. Nothing will overwrite your account until you choose.</p><div className="sync-conflict-versions"><section><h3>This device’s draft</h3><pre>{describe(conflict.local)}</pre></section><section><h3>Other saved version</h3><pre>{describe(conflict.remote)}</pre></section></div><div className="dialog-actions"><button className="button primary" onClick={() => actions.current.resolve(conflict.id, "local")}>Keep this draft</button><button className="button secondary" onClick={() => actions.current.resolve(conflict.id, "remote")}>Use other version</button>{conflict.kind === "notes" && <button className="button secondary" onClick={() => actions.current.resolve(conflict.id, "both")}>Combine both notes</button>}<button className="button secondary" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ conflicts, progress }, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "opsstudio-conflicting-versions.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download both versions</button></div></>}
      </Dialog>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">{toast}</div>
    </StudioContext.Provider>
  );
}

"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  emptyProgress,
  savedProgressSchema,
  type SavedProgress,
} from "@/lib/engine";
import { browserSupabase } from "@/lib/supabase/browser";
import { MotionConfig } from "motion/react";

type Context = {
  progress: SavedProgress;
  update: (fn: (value: SavedProgress) => SavedProgress) => void;
  user: User | null;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<SavedProgress>(emptyProgress);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState("Saved on this device");
  const [toast, setToast] = useState("");
  const loadedUser = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => {
    const db = browserSupabase();
    let disposed = false;
    async function load(nextUser: User | null) {
      const key = nextUser?.id || "guest";
      if (loadedUser.current === key) return;
      loadedUser.current = key;
      const ticket = ++generation.current;
      setReady(false);
      setUser(nextUser);
      let next = emptyProgress;
      try {
        const raw =
          localStorage.getItem(`opsstudio:v1:${key}`) ||
          (nextUser ? localStorage.getItem("opsstudio:v1:guest") : null);
        if (raw) {
          const parsed = savedProgressSchema.safeParse(JSON.parse(raw));
          if (parsed.success) next = parsed.data;
        }
      } catch {
        /* A corrupt device record must not prevent learning. */
      }
      if (nextUser) {
        try {
          const response = await fetch("/api/progress");
          const data = await response.json();
          const parsed = savedProgressSchema.safeParse(data.progress);
          if (response.ok && parsed.success) {
            if (parsed.data.updatedAt >= next.updatedAt) next = parsed.data;
            setSync("Synced to your account");
          } else if (response.ok) setSync("Ready to sync");
          else setSync("Device saved · sync unavailable");
        } catch {
          setSync("Device saved · offline");
        }
      } else setSync("Saved on this device");
      if (!disposed && ticket === generation.current) {
        setProgress(next);
        setReady(true);
      }
    }
    if (db) {
      db.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (!disposed) void load(user);
        })
        .catch(() => {
          if (!disposed) void load(null);
        });
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => {
          if (!disposed) void load(session?.user ?? null);
        }, 0);
      });
      return () => {
        disposed = true;
        data.subscription.unsubscribe();
      };
    }
    queueMicrotask(() => {
      if (!disposed) void load(null);
    });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        `opsstudio:v1:${user?.id || "guest"}`,
        JSON.stringify(progress),
      );
    } catch {
      queueMicrotask(() =>
        setSync("Device storage is full · export your notebook"),
      );
    }
    if (!user) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(progress),
        signal: controller.signal,
      })
        .then((r) =>
          setSync(
            r.ok ? "Synced to your account" : "Device saved · sync unavailable",
          ),
        )
        .catch(() => {
          if (!controller.signal.aborted) setSync("Device saved · offline");
        });
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [progress, ready, user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <StudioContext.Provider
      value={{
        progress,
        update: (fn) =>
          setProgress((value) => ({
            ...fn(value),
            updatedAt: new Date().toISOString(),
          })),
        user,
        ready,
        sync,
        notify: setToast,
        toast,
      }}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast}
      </div>
    </StudioContext.Provider>
  );
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { emptyProgress, savedProgressSchema, type SavedProgress } from "../src/lib/engine.ts";
import * as reconciliation from "../src/lib/progress-sync.ts";
import { assertDeviceEpoch, DeviceRecordRemovedError } from "../src/lib/device-progress.ts";
import type { DeviceRecord } from "../src/lib/progress-sync.ts";
const userA = { id: "11111111-1111-4111-8111-111111111111" };
const userB = { id: "22222222-2222-4222-8222-222222222222" };
const tick = async () => { await setImmediate(); await setImmediate(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function deviceStore() {
  const records = new Map<string, DeviceRecord>();
  let queue: Promise<unknown> = Promise.resolve();
  let barrier: ReturnType<typeof deferred<void>> | undefined;
  return {
    records,
    block() { barrier = deferred<void>(); return () => barrier?.resolve(); },
    readDeviceRecord: async (id: string) => structuredClone(records.get(id) ?? reconciliation.newDeviceRecord(id)),
    changeDeviceRecord(id: string, transform: (record: DeviceRecord) => DeviceRecord, epoch?: string) {
      const job = queue.catch(() => undefined).then(async () => {
        const waiting = barrier;
        if (waiting) { await waiting.promise; if (barrier === waiting) barrier = undefined; }
        const old = structuredClone(records.get(id) ?? reconciliation.newDeviceRecord(id));
        assertDeviceEpoch(old, epoch);
        const next = transform(old);
        records.set(id, next);
        return structuredClone(next);
      });
      queue = job;
      return job;
    },
    async deleteDeviceRecord(id: string) {
      await queue.catch(() => undefined);
      records.set(id, { ...reconciliation.newDeviceRecord(id), localEpoch: crypto.randomUUID() });
    },
  };
}
function provider(store = deviceStore(), initialUser: typeof userA | null = userA) {
  const state: unknown[] = [];
  const effects: (() => void | (() => void))[] = [];
  const events = new Map<string, () => void>();
  const timers = new Map<number, { fn: () => void; delay: number }>();
  const writes: { url: string; init?: RequestInit }[] = [];
  let timerId = 0;
  let authChanged!: (event: string, session: { user: typeof userA } | null) => void;
  let fetcher = async (_url: string, init?: RequestInit): Promise<Response> => Response.json({ progress: null, revision: 0, userId: new Headers(init?.headers).get("x-opsstudio-principal") });
  const dom = { addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name), visibilityState: "visible" };
  const element = (_type: unknown, props: unknown, ...children: unknown[]) => ({ props, children });
  const dependencies = {
    React: { createElement: element },
    createContext: () => ({ Provider: "provider" }), useContext: () => null,
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => { const index = state.length; state.push(initial); return [initial, (value: unknown) => { state[index] = value; }]; },
    browserSupabase: () => ({ auth: {
      getUser: async () => ({ data: { user: initialUser } }),
      onAuthStateChange: (callback: typeof authChanged) => { authChanged = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    } }),
    emptyProgress, savedProgressSchema, ...reconciliation, ...store, DeviceRecordRemovedError,
    MotionConfig: "motion", Dialog: "dialog", document: dom, window: dom, BroadcastChannel: undefined,
    localStorage: { setItem() {} },
    setTimeout: (fn: () => void, delay: number) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: async (url: string, init?: RequestInit) => { writes.push({ url, init }); return fetcher(url, init); },
  };
  const source = ts.transpileModule(readFileSync(new URL("../src/components/app-provider.tsx", import.meta.url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^import[\s\S]*?;\s*/gm, "").replace(/^export /gm, "");
  const component = new Function(...Object.keys(dependencies), `${source};return AppProvider;`)(...Object.values(dependencies));
  const tree = component({ children: null });
  const context = tree.props.value as { update(fn: (value: SavedProgress) => SavedProgress): void; clearLocalData(id: string): Promise<void> };
  const cleanup = effects[0]() as () => void;
  return {
    store, state, context, writes,
    auth(user: typeof userA | null) { authChanged(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null); },
    fetch(next: typeof fetcher) { fetcher = next; },
    runTimer(delay: number) { const entry = [...timers].find(([, value]) => value.delay === delay); assert.ok(entry, `Missing ${delay}ms timer`); timers.delete(entry[0]); entry[1].fn(); },
    event(name: string) { events.get(name)?.(); }, cleanup,
  };
}

describe("provider lifecycle with the real effect and synthetic storage/network", () => {
  it("retains a failed optimistic note when the next unrelated edit commits", async () => {
    const store = deviceStore(), original = store.changeDeviceRecord;
    let fail = true;
    store.changeDeviceRecord = (id, transform, epoch) => {
      if (fail) { fail = false; return Promise.reject(new Error("Transient device storage failure")); }
      return original(id, transform, epoch);
    };
    const f = provider(store); await tick();
    f.context.update((value) => ({ ...value, notes: "keep this failed note" })); await tick();
    assert.equal((f.state[0] as SavedProgress).notes, "keep this failed note");
    f.context.update((value) => ({ ...value, portfolio: { ...value.portfolio, activeProject: "copper-ledger" } })); await tick();
    assert.equal(store.records.get(userA.id)?.draft.notes, "keep this failed note");
    assert.equal(store.records.get(userA.id)?.draft.portfolio.activeProject, "copper-ledger");
    assert.equal((f.state[0] as SavedProgress).notes, "keep this failed note");
    f.cleanup();
  });
  it("retries a failed guest device write without requiring another edit", async () => {
    const store = deviceStore(), original = store.changeDeviceRecord;
    let fail = true;
    store.changeDeviceRecord = (id, transform, epoch) => {
      if (fail) { fail = false; return Promise.reject(new Error("Transient device storage failure")); }
      return original(id, transform, epoch);
    };
    const f = provider(store, null); await tick();
    f.context.update((value) => ({ ...value, notes: "offline guest draft" })); await tick();
    f.runTimer(1000); await tick();
    assert.equal(store.records.get("guest")?.draft.notes, "offline guest draft");
    assert.equal(f.state[3], "Saved on this device");
    assert.equal(f.writes.length, 0);
    f.cleanup();
  });
  it("flushes failed local intent before sending a cloud snapshot", async () => {
    const store = deviceStore(), original = store.changeDeviceRecord;
    let fail = true;
    store.changeDeviceRecord = (id, transform, epoch) => {
      if (fail) { fail = false; return Promise.reject(new Error("Transient device storage failure")); }
      return original(id, transform, epoch);
    };
    const f = provider(store); await tick();
    f.context.update((value) => ({ ...value, notes: "newest accepted note" })); await tick();
    assert.equal(f.writes.length, 0);
    f.fetch(async (_url, init) => {
      if (init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        assert.equal(sent.progress.notes, "newest accepted note");
        return Response.json({ userId: userA.id, progress: sent.progress, revision: 1, saved: true });
      }
      return Response.json({ userId: userA.id, progress: null, revision: 0 });
    });
    f.runTimer(1000); await tick();
    assert.equal(store.records.get(userA.id)?.base.notes, "newest accepted note");
    assert.equal(f.state[3], "Synced to your account");
    f.cleanup();
  });
  it("keeps retrying a failed captured-account edit after signout without displaying it for the guest", async () => {
    const store = deviceStore(), original = store.changeDeviceRecord;
    let fail = true;
    store.changeDeviceRecord = (id, transform, epoch) => {
      if (fail) { fail = false; return Promise.reject(new Error("Transient device storage failure")); }
      return original(id, transform, epoch);
    };
    const f = provider(store); await tick();
    f.context.update((value) => ({ ...value, notes: "private account edit" })); await tick();
    f.auth(null); await tick();
    f.runTimer(1000); await tick();
    assert.equal(store.records.get(userA.id)?.draft.notes, "private account edit");
    assert.equal((f.state[0] as SavedProgress).notes, "");
    assert.equal(store.records.get("guest")?.draft.notes ?? "", "");
    f.cleanup();
  });
  it("flushes already accepted local edits to their captured principal after immediate signout", async () => {
    const f = provider(); await tick();
    const release = f.store.block();
    f.context.update((value) => ({ ...value, notes: "last account note" }));
    f.auth(null); await tick();
    assert.equal((f.state[1] as typeof userA | null), null);
    release(); await tick();
    assert.equal(f.store.records.get(userA.id)?.draft.notes, "last account note");
    assert.equal(f.store.records.get("guest")?.draft.notes ?? "", "");
    assert.equal((f.state[0] as SavedProgress).notes, "");
    f.cleanup();
  });
  it("fences a stale tab write after the other tab clears the same principal", async () => {
    const store = deviceStore();
    store.records.set(userA.id, reconciliation.newDeviceRecord(userA.id, { ...structuredClone(emptyProgress), notes: "private notes" }));
    const first = provider(store), stale = provider(store); await tick();
    await first.context.clearLocalData(userA.id);
    const tombstone = store.records.get(userA.id)!;
    assert.notEqual(tombstone.localEpoch, "initial");
    stale.context.update((value) => ({ ...value, notes: "delayed old-tab note" }));
    await tick();
    assert.equal(store.records.get(userA.id)?.draft.notes, "");
    assert.equal(stale.state[2], false);
    first.cleanup(); stale.cleanup();
  });
  it("ignores an old account's delayed cloud response after a principal switch", async () => {
    const f = provider(); await tick();
    const response = deferred<Response>();
    f.fetch(async () => response.promise);
    f.runTimer(0); await tick();
    f.auth(userB); await tick();
    response.resolve(Response.json({ userId: userA.id, revision: 50, progress: { ...structuredClone(emptyProgress), notes: "A private cloud note" } }));
    await tick();
    assert.equal((f.state[1] as typeof userA).id, userB.id);
    assert.equal((f.state[0] as SavedProgress).notes, "");
    assert.equal(f.store.records.get(userB.id)?.draft.notes ?? "", "");
    f.cleanup();
  });
  it("keeps guest notes separate when an account signs in on the same device", async () => {
    const store = deviceStore();
    store.records.set("guest", reconciliation.newDeviceRecord("guest", { ...structuredClone(emptyProgress), notes: "guest private draft" }));
    const f = provider(store, null); await tick();
    assert.equal((f.state[0] as SavedProgress).notes, "guest private draft");
    f.auth(userA); await tick();
    assert.equal((f.state[0] as SavedProgress).notes, "");
    assert.equal(store.records.get("guest")?.draft.notes, "guest private draft");
    f.cleanup();
  });
  it("retries an offline draft on reconnect without requiring another edit", async () => {
    const f = provider(); await tick();
    f.context.update((value) => ({ ...value, notes: "offline note" })); await tick();
    f.fetch(async () => { throw new Error("offline"); });
    f.runTimer(700); await tick();
    assert.match(String(f.state[3]), /waiting to sync/);
    f.fetch(async (_url, init) => {
      if (init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        assert.equal(sent.expectedUserId, userA.id);
        assert.equal(sent.expectedRevision, 0);
        return Response.json({ userId: userA.id, progress: sent.progress, revision: 1, saved: true });
      }
      return Response.json({ userId: userA.id, progress: null, revision: 0 });
    });
    f.event("online"); f.runTimer(0); await tick();
    assert.equal(f.store.records.get(userA.id)?.revision, 1);
    assert.equal(f.store.records.get(userA.id)?.base.notes, "offline note");
    assert.equal(f.state[3], "Synced to your account");
    f.cleanup();
  });
});

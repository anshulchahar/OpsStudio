import { savedProgressSchema } from "./engine.ts";
import { deviceRecordSchema, newDeviceRecord, type DeviceRecord } from "./progress-sync.ts";

const DATABASE = "opsstudio-progress-v2";
const STORE = "records";
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "principalId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error ?? new Error("Device storage unavailable")); };
  });
  return database;
}

function legacyRecord(principalId: string) {
  // An account may migrate only its own old record. Guest notes are never an
  // implicit source for a signed-in account, even on its first visit.
  try {
    const raw = localStorage.getItem(`opsstudio:v1:${principalId}`);
    if (raw) {
      const parsed = savedProgressSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return newDeviceRecord(principalId, parsed.data);
    }
  } catch { /* A corrupt or unavailable legacy record does not cross identities. */ }
  return newDeviceRecord(principalId);
}

/** One read/write transaction serializes competing tabs, including offline tabs. */
export class DeviceRecordRemovedError extends Error {
  constructor() { super("This device record was removed in another tab. Reload before continuing."); }
}
export function assertDeviceEpoch(record: DeviceRecord, expectedEpoch?: string) {
  if (expectedEpoch !== undefined && record.localEpoch !== expectedEpoch) throw new DeviceRecordRemovedError();
}
export async function changeDeviceRecord(principalId: string, change: (value: DeviceRecord) => DeviceRecord, expectedEpoch?: string): Promise<DeviceRecord> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    let result: DeviceRecord;
    let failure: unknown;
    const request = store.get(principalId);
    request.onsuccess = () => {
      try {
        const parsed = deviceRecordSchema.safeParse(request.result);
        const current = parsed.success && parsed.data.principalId === principalId ? parsed.data : legacyRecord(principalId);
        assertDeviceEpoch(current, expectedEpoch);
        result = deviceRecordSchema.parse(change(current));
        if (result.principalId !== principalId) throw new Error("Device record identity mismatch");
        store.put(result);
      } catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => {
      try { localStorage.removeItem(`opsstudio:v1:${principalId}`); } catch { /* Optional legacy cleanup. */ }
      resolve(result!);
    };
    transaction.onerror = transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Device storage could not save this change."));
  });
}

export function readDeviceRecord(principalId: string) { return changeDeviceRecord(principalId, (record) => record); }

export async function deleteDeviceRecord(principalId: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    // A durable empty tombstone fences delayed writes from other tabs. A later
    // explicit visit loads its new epoch and can begin a fresh device record.
    transaction.objectStore(STORE).put({ ...newDeviceRecord(principalId), localEpoch: crypto.randomUUID() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Device record removal could not finish."));
  });
  for (const version of ["v1", "v2"]) {
    try { localStorage.removeItem(`opsstudio:${version}:${principalId}`); } catch { /* Storage can be disabled separately. */ }
  }
}

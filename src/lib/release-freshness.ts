export const RELEASE_STALE_MS = 48 * 60 * 60 * 1000;

export function releaseFreshness(checkedAt: string | null | undefined, lastAttemptFailed: boolean, now = Date.now()) {
  const checked = checkedAt ? Date.parse(checkedAt) : NaN;
  if (!Number.isFinite(checked)) return { stale: true, label: "No verified release yet" };
  if (now - checked > RELEASE_STALE_MS || checked > now + 60_000)
    return { stale: true, label: "Out of date · check the official source" };
  if (lastAttemptFailed) return { stale: true, label: "Latest refresh failed · showing the last verified release" };
  return { stale: false, label: "Source checked within 48 hours" };
}

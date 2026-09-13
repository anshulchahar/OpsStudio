import { z } from "zod";
import { gzipSync } from "node:zlib";

export const accountDeletionSchema = z.object({
  confirmation: z.literal("DELETE"),
  password: z.string().min(1).max(1024),
  cancelSubscriptions: z.boolean().default(false),
  expectedUserId: z.string().uuid(),
});

export class AccountActionError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AccountActionError";
    this.status = status;
    this.code = code;
  }
}

export async function collectExportPages(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
) {
  const rows: unknown[] = [];
  for (let page = 0; page < 200; page++) {
    const { data, error } = await fetchPage(page * 500, page * 500 + 499);
    if (error || !data) throw new AccountActionError("Your complete export could not be read. Please try again.", 503, "EXPORT_UNAVAILABLE");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
  throw new AccountActionError("This account needs an operator-assisted export because of its size. Your data has not been changed.", 413, "EXPORT_TOO_LARGE");
}

type ErasureDependencies = {
  verifyPassword: (password: string) => Promise<{ userId: string; accessToken: string }>;
  prepareBilling: (cancelSubscriptions: boolean) => Promise<void>;
  revokeSessions: (accessToken: string) => Promise<void>;
  deleteUser: () => Promise<void>;
  closeVerificationSession: (accessToken: string) => Promise<void>;
};

/** Resource deletion is ordered so no account disappears while billing is unresolved. */
export async function eraseAccount(
  authenticatedUserId: string,
  input: unknown,
  dependencies: ErasureDependencies,
) {
  const request = accountDeletionSchema.parse(input);
  if (request.expectedUserId !== authenticatedUserId) {
    throw new AccountActionError("Your signed-in account changed. Reload before deleting an account.", 409, "ACCOUNT_CHANGED");
  }
  const verification = await dependencies.verifyPassword(request.password);
  let revoked = false;
  try {
    if (verification.userId !== authenticatedUserId) {
      throw new AccountActionError("The password did not verify this account.", 403, "REAUTHENTICATION_FAILED");
    }
    await dependencies.prepareBilling(request.cancelSubscriptions);
    await dependencies.revokeSessions(verification.accessToken);
    revoked = true;
    await dependencies.deleteUser();
    return { deleted: true as const };
  } finally {
    // A rejected billing decision must not leave a new verification session alive.
    if (!revoked) await dependencies.closeVerificationSession(verification.accessToken).catch(() => {});
  }
}

export function publicAccountIdentity(user: {
  id: string;
  email?: string;
  created_at?: string;
  email_confirmed_at?: string;
}) {
  // Never serialize a full Auth user/session object into the export.
  return { id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null, emailConfirmedAt: user.email_confirmed_at ?? null };
}

export function encodeAccountExport(data: unknown) {
  const archive = gzipSync(JSON.stringify(data));
  // Stay below the host's buffered response ceiling. Never return a successful
  // download which the platform will silently replace or truncate.
  if (archive.byteLength > 4 * 1024 * 1024) throw new AccountActionError("This account needs an operator-assisted export because of its size. Your data has not been changed.", 413, "EXPORT_TOO_LARGE");
  return new Uint8Array(archive);
}

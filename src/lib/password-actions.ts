import { z } from "zod";

export const passwordUpdateSchema = z.object({
  expectedUserId: z.string().uuid(),
  password: z.string().min(10).max(1024),
});

type PasswordUser = { id: string };
type PasswordSession = {
  getUser: () => Promise<{ data: { user: PasswordUser | null }; error: unknown }>;
  updateUser: (input: { password: string }) => Promise<{ data: { user: PasswordUser | null }; error: unknown }>;
};

/** The dependency must be a new server client bound to this request's token. */
export async function changeRequestPassword(input: unknown, session: PasswordSession) {
  const parsed = passwordUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Enter a password of 10–1024 characters and confirm the current account." };
  const { data, error } = await session.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Your recovery session expired. Request another recovery link." };
  if (data.user.id !== parsed.data.expectedUserId) return { ok: false as const, status: 409, message: "Your signed-in account changed. Request a recovery link for the account you want to update." };
  const updated = await session.updateUser({ password: parsed.data.password });
  if (updated.error || !updated.data.user) return { ok: false as const, status: 400, message: "The password could not be updated. Use a different password or request a new recovery link." };
  if (updated.data.user.id !== parsed.data.expectedUserId) throw new Error("Request-scoped password session changed identity");
  return { ok: true as const, userId: updated.data.user.id };
}

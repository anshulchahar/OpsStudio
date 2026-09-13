import { z } from "zod";

export function operatorDetails(env: Record<string, string | undefined> = process.env) {
  const name = env.OPERATOR_NAME?.trim() || null;
  const parsedEmail = z.string().email().safeParse(env.OPERATOR_EMAIL?.trim());
  const email = parsedEmail.success ? parsedEmail.data : null;
  const address = env.OPERATOR_POSTAL_ADDRESS?.trim() || null;
  const country = env.OPERATOR_COUNTRY?.trim() || null;
  return { name, email, address, country, configured: Boolean(name && email && address && country) };
}

export function retentionDays(env: Record<string, string | undefined> = process.env) {
  const days = (key: string, fallback: number) => {
    const value = Number(env[key] ?? fallback);
    return Number.isInteger(value) && value >= 1 && value <= 3650 ? value : fallback;
  };
  return {
    ai: days("AI_RETENTION_DAYS", 90),
    labs: days("LAB_RETENTION_DAYS", 90),
    usage: days("USAGE_RETENTION_DAYS", 90),
    billingEvents: days("STRIPE_EVENT_RETENTION_DAYS", 90),
    operations: days("OPERATIONS_RETENTION_DAYS", 30),
  };
}

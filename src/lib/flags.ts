import { sql } from "drizzle-orm";
import { db } from "../db";
import { run1Flags, type Run1Flag } from "./catalog";

export interface FlagProvider {
  enabled(key: Run1Flag, cohort?: { type: string; id: string }): Promise<boolean>;
}
const cache = new Map<string, { value: boolean; expires: number }>();
export function flagPrerequisite(key: Run1Flag, env: Partial<NodeJS.ProcessEnv> = process.env) {
  if (key === "shop.photo_entry" || key === "customer.photo_tagging")
    return Boolean((env.GEMINI_TIER === "prod" ? env.GEMINI_API_KEY_PROD : env.GEMINI_API_KEY_DEV)
      && env.S3_BUCKET && env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  if (env.NODE_ENV === "production" && env.APP_ENV !== "staging" &&
    (key === "shop.onboarding" || key === "notifications.digest"))
    return Boolean(env.EMAIL_PROVIDER_KEY);
  if (env.NODE_ENV === "production" && env.APP_ENV !== "staging" && key === "customer.accounts")
    return Boolean(env.SMS_PROVIDER_KEY && env.DLT_SENDER_ID && env.DLT_TEMPLATE_ID);
  return true;
}
export class DatabaseFlags implements FlagProvider {
  async enabled(key: Run1Flag, cohort?: { type: string; id: string }) {
    if (!(key in run1Flags) || !flagPrerequisite(key)) return false;
    const cacheKey = `${key}:${cohort?.type ?? ""}:${cohort?.id ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;
    try {
      const rows = await db.execute(sql`SELECT COALESCE(
        (SELECT enabled FROM flag_rule WHERE flag_key=${key} AND cohort=${cohort?.type ?? ""}
         AND cohort_id=${cohort?.id ?? ""} ORDER BY id LIMIT 1),
        (SELECT enabled FROM flag WHERE key=${key}), false) AS enabled`);
      const value = rows[0]?.enabled === true;
      cache.set(cacheKey, { value, expires: Date.now() + 30_000 });
      return value;
    } catch {
      return false;
    }
  }
}
export const flags: FlagProvider = new DatabaseFlags();
export async function setFlag(key: Run1Flag, enabled: boolean, actor: string) {
  if (!(key in run1Flags)) throw new Error("UNKNOWN_FLAG");
  if (enabled && !flagPrerequisite(key)) throw new Error("MISSING_FLAG_CONFIGURATION");
  await db.transaction(async tx => {
    await tx.execute(sql`UPDATE flag SET enabled=${enabled} WHERE key=${key}`);
    await tx.execute(sql`INSERT INTO flag_audit(flag_key,actor,enabled) VALUES (${key},${actor},${enabled})`);
  });
  cache.clear();
}
export function clearFlagCache() { cache.clear(); }

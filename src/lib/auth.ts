import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "../db";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  return process.env.SESSION_SECRET;
};
export const hashSecret = (value: string) => digest(`${secret()}:${value}`);
export function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export async function requestIP() {
  const h = await headers();
  // The reverse proxy must overwrite this header; never trust client-supplied forwarded headers.
  return h.get("x-real-ip") ?? "unknown";
}
export async function enforceChallengeLimit(identity: string, ip: string) {
  const [row] = await db.execute(sql`
    SELECT (SELECT count(*) FROM auth_challenge WHERE identity=${identity}
      AND created_at > now()-interval '1 hour') AS per_identity,
      (SELECT count(*) FROM auth_challenge WHERE requested_ip=${ip}
      AND created_at > now()-interval '1 hour') AS per_ip`);
  if (Number(row.per_identity) >= 5 || Number(row.per_ip) >= 20) throw new Error("RATE_LIMITED");
}
export async function createChallenge(identity: string, kind: "otp" | "magic", ip: string) {
  await enforceChallengeLimit(identity, ip);
  const value = kind === "otp" ? String(randomInt(100000, 1000000)) : randomBytes(32).toString("hex");
  const [row] = await db.execute(sql`INSERT INTO auth_challenge(identity,kind,secret_hash,expires_at,requested_ip)
    VALUES (${identity},${kind},${hashSecret(value)},now()+interval '10 minutes',${ip}) RETURNING id`);
  return { id: String(row.id), value };
}
export async function consumeChallenge(identity: string, kind: "otp" | "magic", value: string) {
  const rows = await db.execute(sql`SELECT id, secret_hash FROM auth_challenge WHERE identity=${identity}
    AND kind=${kind} AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1`);
  if (!rows[0] || !safeEqual(String(rows[0].secret_hash), hashSecret(value))) return false;
  const result = await db.execute(sql`UPDATE auth_challenge SET consumed_at=now()
    WHERE id=${rows[0].id} AND consumed_at IS NULL RETURNING id`);
  return result.length === 1;
}
export async function startSession(type: "shop" | "customer", id: string) {
  const token = randomBytes(32).toString("hex");
  await db.execute(sql`INSERT INTO auth_session(token_hash,subject_type,subject_id,expires_at)
    VALUES (${hashSecret(token)},${type},${id}::uuid,now()+interval '7 days')`);
  (await cookies()).set("session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 7 * 24 * 3600
  });
}
export async function requireSession(type: "shop" | "customer") {
  const token = (await cookies()).get("session")?.value;
  if (!token) throw new Error("UNAUTHORIZED");
  const [row] = await db.execute(sql`SELECT subject_id FROM auth_session
    WHERE token_hash=${hashSecret(token)} AND subject_type=${type} AND expires_at>now()`);
  if (!row) throw new Error("UNAUTHORIZED");
  return String(row.subject_id);
}
export async function requireShop(shopId: string) {
  const userId = await requireSession("shop");
  const [row] = await db.execute(sql`SELECT 1 FROM shop_user
    WHERE shop_id=${shopId}::uuid AND user_id=${userId}::uuid`);
  if (!row) throw new Error("FORBIDDEN");
  return userId;
}

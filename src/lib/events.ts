import { sql } from "drizzle-orm";
import { db } from "../db";

export async function recordEvent(actor: string, type: string, subject: string,
  payload: unknown = {}, snapshot: unknown = {}) {
  await db.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot)
    VALUES (${actor},${type},${subject},${JSON.stringify(payload)}::jsonb,${JSON.stringify(snapshot)}::jsonb)`);
}

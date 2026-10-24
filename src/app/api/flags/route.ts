import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../lib/admin";
import { run1Flags, type Run1Flag } from "../../../lib/catalog";
import { setFlag } from "../../../lib/flags";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
const input = z.object({ key: z.string(), enabled: z.boolean() });
export async function GET(req: NextRequest) {
  requireAdmin(req);
  return NextResponse.json({ flags: await db.execute(sql`SELECT key,enabled,owner,description,removal_target
    FROM flag ORDER BY key`) });
}
export async function PATCH(req: NextRequest) {
  const actor = requireAdmin(req);
  const { key, enabled } = input.parse(await req.json());
  if (!(key in run1Flags)) return NextResponse.json({ error: "UNKNOWN_FLAG" }, { status: 400 });
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "staging" && enabled)
    return NextResponse.json({ error: "PRODUCTION_FLAGS_DISABLED" }, { status: 403 });
  try {
    await setFlag(key as Run1Flag, enabled, actor);
    return NextResponse.json({ key, enabled });
  } catch {
    return NextResponse.json({ error: "MISSING_FLAG_CONFIGURATION" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { guarded } from "../../../lib/http";
import { recordEvent } from "../../../lib/events";
const input = z.object({ targetType: z.enum(["design","photo"]), targetId: z.string().uuid(),
  reason: z.string().min(10).max(1000) });
export async function POST(req: NextRequest) {
  return guarded("marketplace.report", async () => {
    const body = input.parse(await req.json());
    const [report] = await db.execute(sql`INSERT INTO report(target_type,target_id,reason)
      VALUES (${body.targetType},${body.targetId}::uuid,${body.reason}) RETURNING id`);
    await recordEvent("reporter", "listing.reported", String(report.id), { targetType: body.targetType });
    return NextResponse.json({ id: report.id }, { status: 201 });
  });
}

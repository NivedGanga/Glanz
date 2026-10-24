import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { requireAdmin } from "../../../../lib/admin";
import { guarded } from "../../../../lib/http";
const input = z.object({ id: z.string().uuid(), status: z.enum(["open","reviewed","removed"]),
  note: z.string().max(1000) });
export async function GET(req: NextRequest) {
  return guarded("marketplace.report", async () => {
    requireAdmin(req);
    return NextResponse.json({ reports: await db.execute(sql`SELECT * FROM report ORDER BY created_at DESC LIMIT 100`) });
  });
}
export async function PATCH(req: NextRequest) {
  return guarded("marketplace.report", async () => {
    const actor = requireAdmin(req);
    const body = input.parse(await req.json());
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE report SET status=${body.status},
        reviewer_history=reviewer_history || ${JSON.stringify([{ actor, note: body.note, status: body.status, at: new Date().toISOString() }])}::jsonb
        WHERE id=${body.id}::uuid`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload) VALUES
        (${actor},'report.reviewed',${body.id},${JSON.stringify({ status: body.status })}::jsonb)`);
    });
    return NextResponse.json({ ok: true });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireSession } from "../../../../../lib/auth";
export async function DELETE(_: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await context.params;
    const actor = await requireSession("customer");
    const [request] = await db.execute(sql`SELECT id FROM request
      WHERE id=${requestId}::uuid AND customer_id=${actor}::uuid`);
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE consent SET withdrawn_at=now()
        WHERE subject_type='request' AND subject_id=${requestId}::uuid
        AND purpose='ai_photo_tagging' AND withdrawn_at IS NULL`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject)
        VALUES (${actor},'consent.withdrawn',${requestId})`);
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
}

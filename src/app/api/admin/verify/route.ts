import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { requireAdmin } from "../../../../lib/admin";
import { guarded } from "../../../../lib/http";
const input = z.object({ shopId: z.string().uuid(), verified: z.boolean(),
  checkNote: z.string().min(10).max(500) });
export async function PATCH(req: NextRequest) {
  return guarded("shop.verified_badge", async () => {
    const actor = requireAdmin(req);
    const body = input.parse(await req.json());
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE shop SET verified_at=${body.verified ? new Date() : null}
        WHERE id=${body.shopId}::uuid`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload) VALUES
        (${actor},'shop.verification_changed',${body.shopId},
          ${JSON.stringify({ verified: body.verified, checkNote: body.checkNote })}::jsonb)`);
    });
    return NextResponse.json({ ok: true });
  });
}

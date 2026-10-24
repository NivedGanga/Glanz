import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireSession } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";

const input = z.object({ shopIds: z.array(z.string().uuid()).min(1).max(5) });
export async function POST(req: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  return guarded("customer.request", async () => {
    const { requestId } = await context.params;
    const actor = await requireSession("customer");
    const { shopIds } = input.parse(await req.json());
    if (new Set(shopIds).size !== shopIds.length) throw new Error("DUPLICATE_SHOP");
    await db.transaction(async tx => {
      const [request] = await tx.execute(sql`SELECT id FROM request WHERE id=${requestId}::uuid
        AND customer_id=${actor}::uuid AND status='draft' FOR UPDATE`);
      if (!request) throw new Error("REQUEST_NOT_FOUND");
      const eligible = await tx.execute(sql`SELECT DISTINCT shop_id FROM recommendation
        WHERE request_id=${requestId}::uuid AND shown_at IS NOT NULL`);
      const allowed = new Set(eligible.map(row => String(row.shop_id)));
      if (shopIds.some(id => !allowed.has(id))) throw new Error("SHOP_NOT_RECOMMENDED");
      for (const shopId of shopIds) {
        await tx.execute(sql`INSERT INTO request_shop(request_id,shop_id) VALUES
          (${requestId}::uuid,${shopId}::uuid)`);
        const [rec] = await tx.execute(sql`SELECT reasons,flag_snapshot
          FROM recommendation WHERE request_id=${requestId}::uuid AND shop_id=${shopId}::uuid
          AND shown_at IS NOT NULL ORDER BY rank LIMIT 1`);
        await tx.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot)
          VALUES (${actor},'recommendation.sent',${shopId},
          ${JSON.stringify({ requestId, reasons: rec.reasons })}::jsonb,
          ${JSON.stringify(rec.flag_snapshot)}::jsonb)`);
      }
      await tx.execute(sql`UPDATE request SET status='sent' WHERE id=${requestId}::uuid`);
    });
    return NextResponse.json({ selected: shopIds });
  });
}

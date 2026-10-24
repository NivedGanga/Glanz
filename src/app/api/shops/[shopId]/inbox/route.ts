import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
const input = z.object({ requestId: z.string().uuid(), action: z.enum(["interested","declined"]),
  reason: z.string().min(2).max(500).optional() });
export async function GET(_: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inbox", async () => {
    const { shopId } = await context.params;
    await requireShop(shopId);
    const rows = await db.execute(sql`SELECT r.id,r.event_start,r.return_end,r.description,r.group_size,
      c.name,c.phone,rs.status,rs.decline_reason FROM request_shop rs
      JOIN request r ON r.id=rs.request_id JOIN customer c ON c.id=r.customer_id
      WHERE rs.shop_id=${shopId}::uuid ORDER BY r.event_start ASC LIMIT 100`);
    return NextResponse.json({ requests: rows });
  });
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inbox", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = input.parse(await req.json());
    if (body.action === "declined" && !await (async () => {
      const { flags } = await import("../../../../../lib/flags");
      return flags.enabled("shop.decline");
    })()) throw new Error("FEATURE_DISABLED");
    if (body.action === "declined" && !body.reason) throw new Error("DECLINE_REASON_REQUIRED");
    await db.transaction(async tx => {
      const [selected] = await tx.execute(sql`UPDATE request_shop SET status=${body.action},
        decline_reason=${body.action === "declined" ? body.reason : null},responded_at=now()
        WHERE request_id=${body.requestId}::uuid AND shop_id=${shopId}::uuid
          AND status='sent' RETURNING request_id`);
      if (!selected) throw new Error("REQUEST_NOT_FOUND");
      const [rec] = await tx.execute(sql`SELECT reasons,flag_snapshot FROM recommendation
        WHERE request_id=${body.requestId}::uuid AND shop_id=${shopId}::uuid
        AND shown_at IS NOT NULL ORDER BY rank LIMIT 1`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot)
        VALUES (${actor},${`recommendation.${body.action}`},${shopId},
        ${JSON.stringify({ requestId: body.requestId, reason: body.reason ?? null, scoringReasons: rec?.reasons ?? [] })}::jsonb,
          ${JSON.stringify(rec?.flag_snapshot ?? {})}::jsonb)`);
    });
    return NextResponse.json({ ok: true });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";

const input = z.object({ designId: z.string().uuid(), periodType: z.enum(["day","weekend","week","custom"]),
  pricePaise: z.number().int().nonnegative().safe() });
export async function PUT(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inventory", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = input.parse(await req.json());
    await db.transaction(async tx => {
      const [design] = await tx.execute(sql`SELECT r.price_paise,d.id,dist.currency
        FROM design d JOIN shop s ON s.id=d.shop_id JOIN district dist ON dist.id=s.district_id
        LEFT JOIN rate_card r ON r.design_id=d.id AND r.period_type=${body.periodType}
        WHERE d.id=${body.designId}::uuid AND d.shop_id=${shopId}::uuid FOR UPDATE OF d`);
      if (!design) throw new Error("DESIGN_NOT_FOUND");
      await tx.execute(sql`INSERT INTO rate_card(design_id,period_type,price_paise,currency)
        VALUES (${body.designId}::uuid,${body.periodType},${body.pricePaise},${design.currency})
        ON CONFLICT(design_id,period_type) DO UPDATE SET price_paise=excluded.price_paise`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload)
        VALUES (${actor},'rate.changed',${body.designId},
        ${JSON.stringify({ period: body.periodType, before: design.price_paise, after: body.pricePaise, currency: design.currency })}::jsonb)`);
    });
    return NextResponse.json({ ok: true });
  });
}

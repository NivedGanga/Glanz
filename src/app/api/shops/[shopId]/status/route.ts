import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";

const input = z.object({ status: z.enum(["published","paused"]), designId: z.string().uuid().optional() });
export async function PATCH(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  const body = input.parse(await req.json());
  return guarded(body.status === "paused" ? "marketplace.pause" : "marketplace.publish", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    await db.transaction(async tx => {
      if (body.status === "published") {
        const [valid] = await tx.execute(sql`SELECT d.id FROM design d
          JOIN unit u ON u.design_id=d.id JOIN rate_card r ON r.design_id=d.id
          JOIN photo p ON p.owner_type='design' AND p.owner_id=d.id AND p.status='active'
          JOIN shop s ON s.id=d.shop_id JOIN branch b ON b.shop_id=s.id
          WHERE s.id=${shopId}::uuid AND (${body.designId ?? null}::uuid IS NULL OR d.id=${body.designId ?? null}::uuid)
          AND length(d.name)>0 AND length(s.phone)>0 AND length(b.address)>0
          AND (p.is_synthetic=false OR (${process.env.NODE_ENV !== "production"} AND s.is_fake AND p.is_fake))
          LIMIT 1`);
        if (!valid) throw new Error("LISTING_INCOMPLETE_OR_NO_OWN_PHOTO");
      }
      if (body.designId) {
        const [updated] = await tx.execute(sql`UPDATE design SET status=${body.status}
          WHERE id=${body.designId}::uuid AND shop_id=${shopId}::uuid RETURNING id`);
        if (!updated) throw new Error("DESIGN_NOT_FOUND");
      } else await tx.execute(sql`UPDATE shop SET listing_status=${body.status}
        WHERE id=${shopId}::uuid`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload)
        VALUES (${actor},'listing.status_changed',${body.designId ?? shopId},
        ${JSON.stringify({ status: body.status })}::jsonb)`);
    });
    return NextResponse.json({ ok: true });
  });
}

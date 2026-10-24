import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { recordEvent } from "../../../../../lib/events";
import { freeEntitlements } from "../../../../../lib/config";

const input = z.object({ designId: z.string().uuid(), branchId: z.string().uuid(),
  condition: z.string().min(1).max(200) });
export async function POST(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inventory", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = input.parse(await req.json());
    const id = await db.transaction(async tx => {
      // Serialise additions per shop so concurrent requests cannot bypass the item cap.
      await tx.execute(sql`SELECT id FROM shop WHERE id=${shopId}::uuid FOR UPDATE`);
      const [row] = await tx.execute(sql`SELECT count(*) AS total FROM unit u
        JOIN design d ON d.id=u.design_id WHERE d.shop_id=${shopId}::uuid`);
      if (Number(row.total) >= freeEntitlements().items) throw new Error("ITEM_CAP_REACHED");
      const [unit] = await tx.execute(sql`INSERT INTO unit(design_id,branch_id,condition)
        SELECT ${body.designId}::uuid,b.id,${body.condition} FROM branch b JOIN design d
          ON d.shop_id=b.shop_id AND d.id=${body.designId}::uuid
        WHERE b.id=${body.branchId}::uuid AND b.shop_id=${shopId}::uuid RETURNING id`);
      if (!unit) throw new Error("INVALID_SHOP_INVENTORY");
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload)
        VALUES (${actor},'unit.created',${unit.id},'{}')`);
      return unit.id;
    });
    return NextResponse.json({ id }, { status: 201 });
  });
}

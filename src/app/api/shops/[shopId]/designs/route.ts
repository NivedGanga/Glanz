import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { recordEvent } from "../../../../../lib/events";
import { validateAttributes } from "../../../../../lib/attributes";

const designInput = z.object({
  categoryId: z.string().uuid(), name: z.string().min(1).max(150),
  description: z.string().max(3000).default(""), attributes: z.record(z.string()).default({})
});
export async function POST(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inventory", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = designInput.parse(await req.json());
    const [category] = await db.execute(sql`SELECT attribute_schema FROM category WHERE id=${body.categoryId}::uuid`);
    if (!category) throw new Error("UNKNOWN_CATEGORY");
    validateAttributes(category.attribute_schema as Record<string, string[]>, body.attributes);
    const [design] = await db.execute(sql`INSERT INTO design(shop_id,category_id,name,description,attributes,is_fake)
      VALUES (${shopId}::uuid,${body.categoryId}::uuid,${body.name},${body.description},
        ${JSON.stringify(body.attributes)}::jsonb,
        (SELECT is_fake FROM shop WHERE id=${shopId}::uuid)) RETURNING id`);
    await recordEvent(actor, "design.created", String(design.id), { shopId });
    return NextResponse.json({ id: design.id }, { status: 201 });
  });
}

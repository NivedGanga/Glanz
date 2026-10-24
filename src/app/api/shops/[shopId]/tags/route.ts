import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { validateAttributes } from "../../../../../lib/attributes";

const input = z.object({ tagId: z.string().uuid(), action: z.enum(["confirm","edit","reject"]),
  value: z.string().optional() });
export async function PATCH(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.photo_entry", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const body = input.parse(await req.json());
    const [tag] = await db.execute(sql`SELECT t.id,t.field,t.value,c.attribute_schema
      FROM tag t JOIN design d ON d.id=t.entity_id AND t.entity_type='design'
      JOIN category c ON c.id=d.category_id
      WHERE t.id=${body.tagId}::uuid AND d.shop_id=${shopId}::uuid AND t.status='suggested'`);
    if (!tag) throw new Error("TAG_NOT_FOUND");
    const value = body.action === "edit" ? body.value : String(tag.value);
    if (body.action !== "reject") {
      if (!value) throw new Error("INVALID_ATTRIBUTE");
      validateAttributes(tag.attribute_schema as Record<string, string[]>, { [String(tag.field)]: value });
    }
    await db.execute(sql`UPDATE tag SET value=${value ?? tag.value},
      status=${body.action === "reject" ? "rejected" : "confirmed"},
      confirmed_by=${body.action === "reject" ? null : actor}::uuid,
      confirmed_at=${body.action === "reject" ? null : new Date()}::timestamptz WHERE id=${body.tagId}::uuid`);
    await db.execute(sql`INSERT INTO event(actor,type,subject,payload)
      VALUES (${actor},'tag.reviewed',${body.tagId},${JSON.stringify({ action: body.action })}::jsonb)`);
    return NextResponse.json({ ok: true });
  });
}

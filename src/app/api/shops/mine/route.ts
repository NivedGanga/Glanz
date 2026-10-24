import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { requireSession } from "../../../../lib/auth";
import { guarded } from "../../../../lib/http";
import { flags } from "../../../../lib/flags";
export async function GET() {
  return guarded("shop.onboarding", async () => {
    const userId = await requireSession("shop");
    const [shop] = await db.execute(sql`SELECT s.id,s.legal_name,s.phone,s.verified_at,
      b.id AS branch_id,b.address FROM shop_user su JOIN shop s ON s.id=su.shop_id
      LEFT JOIN branch b ON b.shop_id=s.id WHERE su.user_id=${userId}::uuid LIMIT 1`);
    if (!shop) throw new Error("FORBIDDEN");
    const designs = await db.execute(sql`SELECT d.id,d.name,d.status,
      COALESCE(json_agg(json_build_object('id',t.id,'field',t.field,'value',t.value))
        FILTER (WHERE t.id IS NOT NULL),'[]') AS tags
      FROM design d LEFT JOIN tag t ON t.entity_id=d.id AND t.entity_type='design'
        AND t.status='suggested' WHERE d.shop_id=${shop.id}::uuid GROUP BY d.id`);
    return NextResponse.json({ shop: { ...shop, verified_at: await flags.enabled("shop.verified_badge") ?
      shop.verified_at : null }, designs });
  });
}

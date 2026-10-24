import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { flags } from "../../../../lib/flags";
export async function GET(_: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await context.params;
  if (!await flags.enabled("customer.search")) return NextResponse.json({ error: "FEATURE_DISABLED" }, { status: 404 });
  const [shop] = await db.execute(sql`SELECT s.id,s.legal_name,s.phone,s.opening_hours,s.verified_at,
    b.address FROM shop s JOIN branch b ON b.shop_id=s.id
    WHERE s.id=${shopId}::uuid AND s.listing_status='published' LIMIT 1`);
  if (!shop) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ shop: { ...shop, verified_at: await flags.enabled("shop.verified_badge") ?
    shop.verified_at : null } });
}

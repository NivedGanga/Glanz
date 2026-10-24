import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { signedPhotoUrl } from "../../../../lib/media";
import { requireSession, requireShop } from "../../../../lib/auth";
export async function GET(_: NextRequest, context: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await context.params;
  const [photo] = await db.execute(sql`SELECT p.storage_key,p.owner_type,p.owner_id
    FROM photo p WHERE p.id=${photoId}::uuid AND p.status='active'`);
  if (!photo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (photo.owner_type === "request") {
    let allowed = false;
    try {
      const customer = await requireSession("customer");
      const [owned] = await db.execute(sql`SELECT 1 FROM request
        WHERE id=${photo.owner_id}::uuid AND customer_id=${customer}::uuid`);
      allowed = Boolean(owned);
    } catch {
      const userId = await requireSession("shop");
      const [selected] = await db.execute(sql`SELECT 1 FROM request_shop rs
        JOIN shop_user su ON su.shop_id=rs.shop_id
        WHERE rs.request_id=${photo.owner_id}::uuid AND su.user_id=${userId}::uuid`);
      allowed = Boolean(selected);
    }
    if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  } else {
    const [design] = await db.execute(sql`SELECT shop_id FROM design WHERE id=${photo.owner_id}::uuid`);
    if (!design) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await requireShop(String(design.shop_id));
  }
  return NextResponse.redirect(await signedPhotoUrl(String(photo.storage_key)));
}

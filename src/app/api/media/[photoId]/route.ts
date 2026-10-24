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
    const customer = await requireSession("customer");
    const [owned] = await db.execute(sql`SELECT 1 FROM request WHERE id=${photo.owner_id}::uuid AND customer_id=${customer}::uuid`);
    if (!owned) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  } else {
    const [design] = await db.execute(sql`SELECT shop_id FROM design WHERE id=${photo.owner_id}::uuid`);
    if (!design) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await requireShop(String(design.shop_id));
  }
  return NextResponse.redirect(await signedPhotoUrl(String(photo.storage_key)));
}

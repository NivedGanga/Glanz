import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireShop } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { storePhoto } from "../../../../../lib/media";
import { queueAnalysis } from "../../../../../lib/jobs";
import { flags } from "../../../../../lib/flags";
import { config } from "../../../../../lib/config";

export async function POST(req: NextRequest, context: { params: Promise<{ shopId: string }> }) {
  return guarded("shop.inventory", async () => {
    const { shopId } = await context.params;
    const actor = await requireShop(shopId);
    const form = await req.formData();
    const file = form.get("photo");
    const designId = String(form.get("designId") ?? "");
    if (!(file instanceof File) || !/image\/(jpeg|png|webp)/.test(file.type)) throw new Error("INVALID_PHOTO");
    const [design] = await db.execute(sql`SELECT id FROM design WHERE id=${designId}::uuid AND shop_id=${shopId}::uuid`);
    if (!design) throw new Error("DESIGN_NOT_FOUND");
    const isSynthetic = process.env.NODE_ENV !== "production" && form.get("synthetic") === "true";
    const key = await storePhoto(Buffer.from(await file.arrayBuffer()));
    const [photo] = await db.execute(sql`INSERT INTO photo(owner_type,owner_id,storage_key,is_synthetic,is_fake)
      VALUES ('design',${designId}::uuid,${key},${isSynthetic},${isSynthetic}) RETURNING id`);
    await db.execute(sql`INSERT INTO event(actor,type,subject,payload) VALUES
      (${actor},'photo.uploaded',${photo.id},${JSON.stringify({ designId })}::jsonb)`);
    let pending = false;
    if (await flags.enabled("shop.photo_entry")) {
      const [usage] = await db.execute(sql`SELECT count(*) AS total FROM photo_analysis pa JOIN photo p ON p.id=pa.photo_id
        JOIN design d ON d.id=p.owner_id AND p.owner_type='design'
        WHERE d.shop_id=${shopId}::uuid AND pa.created_at>=date_trunc('month',now())`);
      if (Number(usage.total) >= config.monthlyAnalyses) throw new Error("AI_QUOTA_REACHED");
      await db.execute(sql`INSERT INTO photo_analysis(photo_id,purpose,provider,model_version,status)
        VALUES (${photo.id}::uuid,'shop_listing','gemini','gemini-2.0-flash','pending')`);
      await queueAnalysis(String(photo.id));
      pending = true;
    }
    return NextResponse.json({ photoId: photo.id, pending }, { status: 201 });
  });
}

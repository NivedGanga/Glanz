import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../../db";
import { requireSession } from "../../../../../lib/auth";
import { guarded } from "../../../../../lib/http";
import { flags } from "../../../../../lib/flags";
import { storePhoto } from "../../../../../lib/media";
import { queueAnalysis } from "../../../../../lib/jobs";
import { shouldAnalyseRequestPhoto } from "../../../../../lib/consent";
import { config } from "../../../../../lib/config";
import { demoMode } from "../../../../../lib/demo";

export async function POST(req: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  return guarded("customer.request", async () => {
    const { requestId } = await context.params;
    const actor = await requireSession("customer");
    const [owned] = await db.execute(sql`SELECT is_fake FROM request
      WHERE id=${requestId}::uuid AND customer_id=${actor}::uuid AND status='draft'`);
    if (!owned) throw new Error("REQUEST_NOT_FOUND");
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File) || !/image\/(jpeg|png|webp)/.test(file.type)) throw new Error("INVALID_PHOTO");
    const [consent] = await db.execute(sql`SELECT id,withdrawn_at FROM consent
      WHERE subject_type='request' AND subject_id=${requestId}::uuid
      AND purpose='ai_photo_tagging' ORDER BY granted_at DESC LIMIT 1`);
    const analyse = shouldAnalyseRequestPhoto(await flags.enabled("customer.photo_tagging"),
      consent ? { withdrawnAt: consent.withdrawn_at as Date | null } : null);
    if (analyse) {
      const [usage] = await db.execute(sql`SELECT count(*) AS total FROM photo_analysis pa
        JOIN photo p ON p.id=pa.photo_id JOIN request r ON r.id=p.owner_id AND p.owner_type='request'
        WHERE r.customer_id=${actor}::uuid AND pa.created_at>=date_trunc('month',now())`);
      if (Number(usage.total) >= config.monthlyAnalyses) throw new Error("AI_QUOTA_REACHED");
    }
    const key = await storePhoto(Buffer.from(await file.arrayBuffer()));
    const synthetic = demoMode() && owned.is_fake === true &&
      form.get("synthetic") === "true";
    const [photo] = await db.execute(sql`INSERT INTO photo(owner_type,owner_id,storage_key,is_synthetic,is_fake)
      VALUES ('request',${requestId}::uuid,${key},${synthetic},${synthetic}) RETURNING id`);
    await db.execute(sql`INSERT INTO request_photo(request_id,photo_id) VALUES
      (${requestId}::uuid,${photo.id}::uuid)`);
    if (analyse) {
      await db.execute(sql`INSERT INTO photo_analysis(photo_id,purpose,consent_id,provider,model_version,status)
        VALUES (${photo.id}::uuid,'customer_request',${consent.id}::uuid,
          ${process.env.PHOTO_TAGGER === "fake" ? "fake" : "gemini"},
          ${process.env.PHOTO_TAGGER === "fake" ? "fake-v1" : "gemini-2.0-flash"},'pending')`);
      await queueAnalysis(String(photo.id));
    }
    await db.execute(sql`INSERT INTO event(actor,type,subject,payload)
      VALUES (${actor},'request.photo_uploaded',${photo.id},${JSON.stringify({ analyse })}::jsonb)`);
    return NextResponse.json({ photoId: photo.id, analysisPending: analyse }, { status: 201 });
  });
}

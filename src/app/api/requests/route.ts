import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { requireSession } from "../../../lib/auth";
import { guarded } from "../../../lib/http";
import { localToUtc } from "../../../lib/availability";
import { flags } from "../../../lib/flags";

const input = z.object({
  districtId: z.string().uuid(), categoryId: z.string().uuid(),
  eventStart: z.string(), returnEnd: z.string(),
  description: z.string().min(1).max(3000), groupSize: z.number().int().min(1).max(100),
  answers: z.record(z.string()).default({}), maxDistanceKm: z.number().positive().optional(),
  consentToAi: z.boolean().default(false), consentVersion: z.string().min(1),
  contactConsentVersion: z.string().min(1)
});
export async function POST(req: NextRequest) {
  return guarded("customer.request", async () => {
    const customerId = await requireSession("customer");
    const body = input.parse(await req.json());
    const [district] = await db.execute(sql`SELECT timezone FROM district WHERE id=${body.districtId}::uuid`);
    const [customer] = await db.execute(sql`SELECT district_id FROM customer WHERE id=${customerId}::uuid`);
    if (!district || String(customer?.district_id) !== body.districtId) throw new Error("DISTRICT_MISMATCH");
    const start = localToUtc(body.eventStart, String(district.timezone));
    const end = localToUtc(body.returnEnd, String(district.timezone));
    if (start >= end) throw new Error("INVALID_WINDOW");
    const aiEnabled = await flags.enabled("customer.photo_tagging");
    const id = await db.transaction(async tx => {
      const [row] = await tx.execute(sql`INSERT INTO request(customer_id,district_id,category_id,event_start,
        return_end,description,group_size,answers,max_distance_km,status,is_fake) VALUES
        (${customerId}::uuid,${body.districtId}::uuid,${body.categoryId}::uuid,
          ${start}::timestamptz,${end}::timestamptz,${body.description},${body.groupSize},
          ${JSON.stringify(body.answers)}::jsonb,${body.maxDistanceKm ?? null},'draft',
          (SELECT is_fake FROM customer WHERE id=${customerId}::uuid)) RETURNING id`);
      await tx.execute(sql`INSERT INTO consent(subject_type,subject_id,purpose,version)
        VALUES ('request',${row.id}::uuid,'contact_sharing',${body.contactConsentVersion})`);
      if (aiEnabled && body.consentToAi) await tx.execute(sql`
        INSERT INTO consent(subject_type,subject_id,purpose,version)
        VALUES ('request',${row.id}::uuid,'ai_photo_tagging',${body.consentVersion})`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot) VALUES
        (${customerId},'request.created',${row.id},
          ${JSON.stringify({ districtId: body.districtId, categoryId: body.categoryId, start, end, groupSize: body.groupSize, answers: body.answers })}::jsonb,
          ${JSON.stringify({ "customer.request": true, "customer.photo_tagging": aiEnabled })}::jsonb)`);
      return row.id;
    });
    return NextResponse.json({ id, aiConsentRecorded: aiEnabled && body.consentToAi }, { status: 201 });
  });
}

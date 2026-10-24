import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { createChallenge, consumeChallenge, requestIP, startSession } from "../../../../lib/auth";
import { sms } from "../../../../lib/adapters";
import { guarded } from "../../../../lib/http";
import { recordEvent } from "../../../../lib/events";
import { demoMode } from "../../../../lib/demo";

const input = z.object({ phone: z.string().regex(/^\+[1-9]\d{1,14}$/), districtId: z.string().uuid(),
  code: z.string().length(6).optional(), name: z.string().min(1).max(100).optional(),
  consentVersion: z.string().min(1).optional() });
export async function POST(req: NextRequest) {
  return guarded("customer.accounts", async () => {
    const body = input.parse(await req.json());
    const [district] = await db.execute(sql`SELECT country_code FROM district WHERE id=${body.districtId}::uuid`);
    if (!district || !body.phone.startsWith(String(district.country_code))) throw new Error("INVALID_PHONE_DISTRICT");
    if (!body.code) {
      const challenge = await createChallenge(body.phone, "otp", await requestIP());
      await sms.send(body.phone, "otp", challenge.value);
      await recordEvent(body.phone, "otp.requested", body.districtId);
      return NextResponse.json({ ok: true });
    }
    if (!await consumeChallenge(body.phone, "otp", body.code)) throw new Error("INVALID_CODE");
    const existing = await db.execute(sql`SELECT id FROM customer WHERE phone=${body.phone}`);
    if (!existing[0] && (!body.name || !body.consentVersion)) throw new Error("SIGNUP_DETAILS_REQUIRED");
    const demo = demoMode();
    const [customer] = existing.length ? existing : await db.execute(sql`
      INSERT INTO customer(phone,name,district_id,is_fake) VALUES
        (${body.phone},${body.name ?? ""},${body.districtId}::uuid,${demo})
      RETURNING id`);
    if (!existing.length) await db.execute(sql`INSERT INTO consent(subject_type,subject_id,purpose,version)
      VALUES ('customer',${customer.id}::uuid,'account',${body.consentVersion ?? ""})`);
    await startSession("customer", String(customer.id));
    await recordEvent(String(customer.id), existing.length ? "customer.signed_in" : "customer.created", String(customer.id));
    return NextResponse.json({ id: customer.id });
  });
}

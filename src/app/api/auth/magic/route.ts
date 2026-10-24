import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { createChallenge, consumeChallenge, requestIP, startSession } from "../../../../lib/auth";
import { email } from "../../../../lib/adapters";
import { guarded } from "../../../../lib/http";
import { recordEvent } from "../../../../lib/events";
import { config } from "../../../../lib/config";

const input = z.object({ email: z.string().email(), token: z.string().optional(),
  districtId: z.string().uuid().optional(), legalName: z.string().min(1).optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  address: z.string().min(1).optional(), consentVersion: z.string().min(1).optional() });
export async function POST(req: NextRequest) {
  return guarded("shop.onboarding", async () => {
    const body = input.parse(await req.json());
    if (!body.token) {
      const { value } = await createChallenge(body.email, "magic", await requestIP());
      await email.send(body.email, "shop_magic_link", `${process.env.APP_ORIGIN}/shop?email=${encodeURIComponent(body.email)}&token=${value}`);
      await recordEvent(body.email, "magic.requested", body.email);
      return NextResponse.json({ ok: true });
    }
    if (!await consumeChallenge(body.email, "magic", body.token)) throw new Error("INVALID_LINK");
    const existing = await db.execute(sql`SELECT su.user_id, su.shop_id FROM shop_user su WHERE su.email=${body.email} LIMIT 1`);
    let userId: string, shopId: string;
    if (existing[0]) {
      userId = String(existing[0].user_id); shopId = String(existing[0].shop_id);
    } else {
      if (!body.districtId || !body.legalName || !body.phone || !body.address || !body.consentVersion)
        throw new Error("SIGNUP_DETAILS_REQUIRED");
      const [district] = await db.execute(sql`SELECT country_code FROM district WHERE id=${body.districtId}::uuid`);
      if (!district || !body.phone.startsWith(String(district.country_code))) throw new Error("INVALID_PHONE_DISTRICT");
      const [shop] = await db.execute(sql`INSERT INTO shop(legal_name,email,district_id,phone,plan_id)
        SELECT ${body.legalName},${body.email},${body.districtId}::uuid,${body.phone},id FROM plan WHERE name='free'
        RETURNING id`);
      if (!shop) throw new Error("PLAN_NOT_CONFIGURED");
      shopId = String(shop.id);
      userId = crypto.randomUUID();
      await db.execute(sql`INSERT INTO shop_user(user_id,shop_id,email,role)
        VALUES (${userId}::uuid,${shopId}::uuid,${body.email},'owner')`);
      await db.execute(sql`INSERT INTO branch(shop_id,address) VALUES (${shopId}::uuid,${body.address})`);
      await db.execute(sql`INSERT INTO shop_settings(shop_id,notification_daily_cap)
        VALUES (${shopId}::uuid,${config.dailyNotifications})`);
      await db.execute(sql`INSERT INTO consent(subject_type,subject_id,purpose,version)
        VALUES ('shop',${shopId}::uuid,'account',${body.consentVersion})`);
    }
    await startSession("shop", userId);
    await recordEvent(userId, existing.length ? "shop.signed_in" : "shop.created", shopId);
    return NextResponse.json({ shopId });
  });
}

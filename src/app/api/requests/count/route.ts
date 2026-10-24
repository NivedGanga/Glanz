import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { guarded } from "../../../../lib/http";
import { localToUtc } from "../../../../lib/availability";
const input = z.object({ districtId: z.string().uuid(), categoryId: z.string().uuid(),
  eventStart: z.string(), returnEnd: z.string(), sizeRange: z.string().optional() });
export async function GET(req: NextRequest) {
  return guarded("customer.guided_request", async () => {
    const body = input.parse(Object.fromEntries(req.nextUrl.searchParams));
    const [district] = await db.execute(sql`SELECT timezone,radius_km,center_lat,center_lng FROM district
      WHERE id=${body.districtId}::uuid`);
    if (!district) throw new Error("DISTRICT_NOT_FOUND");
    const start = localToUtc(body.eventStart, String(district.timezone));
    const end = localToUtc(body.returnEnd, String(district.timezone));
    if (start >= end) throw new Error("INVALID_WINDOW");
    const [row] = await db.execute(sql`SELECT count(DISTINCT s.id) AS shops FROM design d
      JOIN shop s ON s.id=d.shop_id JOIN shop_settings ss ON ss.shop_id=s.id
      JOIN category c ON c.id=d.category_id JOIN branch b ON b.shop_id=s.id
      WHERE d.category_id=${body.categoryId}::uuid AND s.district_id=${body.districtId}::uuid
        AND s.listing_status='published' AND d.status='published'
        AND NOT d.category_id=ANY(ss.muted_categories)
        AND (${body.sizeRange ?? null}::text IS NULL OR d.attributes->>'size_range'=${body.sizeRange ?? null})
        AND (${district.radius_km}::float8 IS NULL OR (b.lat IS NOT NULL AND b.lng IS NOT NULL
          AND 6371*acos(least(1,greatest(-1,cos(radians(${district.center_lat}::float8))*
            cos(radians(b.lat))*cos(radians(b.lng)-radians(${district.center_lng}::float8))+
            sin(radians(${district.center_lat}::float8))*sin(radians(b.lat)))))<=${district.radius_km}))
        AND EXISTS (SELECT 1 FROM unit u WHERE u.design_id=d.id AND u.branch_id=b.id
          AND NOT EXISTS (SELECT 1 FROM availability_block ab WHERE ab.unit_id=u.id
            AND ab.time_range && tstzrange(
              ${start}::timestamptz-COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day',
              ${end}::timestamptz+COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day','[)'))`);
    return NextResponse.json({ shops: Number(row.shops) });
  });
}

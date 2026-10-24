import { sql } from "drizzle-orm";
import { db } from "../db";
import { availabilityLabel, localToUtc } from "./availability";
import { config } from "./config";
import { flags } from "./flags";

export function normaliseTerm(value: string, entries: { term: string; canonicalValue: string;
  categoryId?: string | null }[] = [], categoryId?: string) {
  const term = value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return entries.find(e => e.term === term && e.categoryId === categoryId)?.canonicalValue ??
    entries.find(e => e.term === term && !e.categoryId)?.canonicalValue ?? term;
}
export type SearchInput = {
  districtId: string; eventStart: string; returnEnd: string; keyword?: string;
  categoryId?: string; size?: string; colour?: string; priceMaxPaise?: number;
  ratingMin?: number; maxDistanceKm?: number; lat?: number; lng?: number
};
export async function search(input: SearchInput) {
  const [district] = await db.execute(sql`SELECT timezone,radius_km,center_lat,center_lng
    FROM district WHERE id=${input.districtId}::uuid`);
  if (!district) throw new Error("DISTRICT_NOT_FOUND");
  const start = localToUtc(input.eventStart, String(district.timezone));
  const end = localToUtc(input.returnEnd, String(district.timezone));
  if (start >= end) throw new Error("INVALID_WINDOW");
  const synonyms = await db.execute(sql`SELECT term,canonical_value AS "canonicalValue",
    category_id AS "categoryId" FROM synonym WHERE status='approved'`);
  const keyword = input.keyword ? normaliseTerm(input.keyword, synonyms as never, input.categoryId) : "";
  const fuzzy = keyword && await flags.enabled("search.fuzzy_keywords");
  const maxDistance = await flags.enabled("customer.distance_filter") ?
    input.maxDistanceKm ?? (district.radius_km === null ? null : Number(district.radius_km)) : null;
  const lat = input.lat ?? district.center_lat;
  const lng = input.lng ?? district.center_lng;
  const results = await db.execute(sql`
    SELECT d.id,d.name,d.description,d.attributes,s.id AS shop_id,s.legal_name,s.phone,
      s.rating_score,r.price_paise,r.currency,
      stock.free_units, loc.distance_km,
      CASE WHEN ${fuzzy === true} THEN GREATEST(similarity(d.name,${keyword}),
        similarity(d.description,${keyword}),
        COALESCE((SELECT max(similarity(t.value,${keyword})) FROM tag t
          WHERE t.entity_type='design' AND t.entity_id=d.id
          AND t.field='keyword' AND t.status='confirmed'),0))
        ELSE 0 END AS keyword_relevance
    FROM design d JOIN shop s ON s.id=d.shop_id JOIN category c ON c.id=d.category_id
    JOIN branch b ON b.shop_id=s.id
    JOIN LATERAL (
      SELECT CASE WHEN b.lat IS NULL OR b.lng IS NULL OR ${lat}::float8 IS NULL OR ${lng}::float8 IS NULL
        THEN NULL ELSE 6371 * acos(least(1,greatest(-1,
          cos(radians(${lat}::float8))*cos(radians(b.lat))*cos(radians(b.lng)-radians(${lng}::float8))
          +sin(radians(${lat}::float8))*sin(radians(b.lat))))) END AS distance_km
    ) loc ON true
    JOIN LATERAL (SELECT count(*)::int AS free_units FROM unit u
      WHERE u.design_id=d.id AND u.branch_id=b.id
      AND NOT EXISTS (SELECT 1 FROM availability_block ab WHERE ab.unit_id=u.id
        AND ab.time_range && tstzrange(
          ${start}::timestamptz-COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day',
          ${end}::timestamptz+COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day','[)'))
    ) stock ON true
    LEFT JOIN rate_card r ON r.design_id=d.id AND r.period_type='day'
    WHERE s.district_id=${input.districtId}::uuid AND s.listing_status='published'
      AND d.status='published' AND stock.free_units>0
      AND (${input.categoryId ?? null}::uuid IS NULL OR d.category_id=${input.categoryId ?? null}::uuid)
      AND (${input.size ?? null}::text IS NULL OR d.attributes->>'size_range'=${input.size ?? null})
      AND (${input.colour ?? null}::text IS NULL OR d.attributes->>'colour'=${input.colour ?? null})
      AND (${input.priceMaxPaise ?? null}::int IS NULL OR r.price_paise<=${input.priceMaxPaise ?? null})
      AND (${input.ratingMin ?? null}::numeric IS NULL OR s.rating_score>=${input.ratingMin ?? null})
      AND (${maxDistance}::float8 IS NULL OR loc.distance_km<=${maxDistance})
      AND (${keyword}='' OR lower(d.name) LIKE '%'||${keyword}||'%'
        OR lower(d.description) LIKE '%'||${keyword}||'%'
        OR (${fuzzy === true} AND GREATEST(similarity(d.name,${keyword}),
          similarity(d.description,${keyword}))>=${config.similarityThreshold}))
    ORDER BY keyword_relevance DESC,loc.distance_km ASC NULLS LAST LIMIT 100`);
  return results.map(row => ({
    id: row.id, name: row.name, shopId: row.shop_id, shop: row.legal_name,
    phone: row.phone, pricePaise: row.price_paise, currency: row.currency,
    rating: row.rating_score, distanceKm: row.distance_km,
    availability: availabilityLabel(Number(row.free_units), config.limitedThreshold)
  }));
}

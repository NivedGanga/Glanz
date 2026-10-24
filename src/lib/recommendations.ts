import { sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "./config";
import { flags } from "./flags";
import { rank, type Candidate, type Criteria } from "./ranking";
import { normaliseTerm } from "./search";

export async function computeRecommendations(requestId: string, record = true) {
  const [request] = await db.execute(sql`SELECT r.*,dist.radius_km,dist.center_lat,dist.center_lng
    FROM request r JOIN district dist ON dist.id=r.district_id WHERE r.id=${requestId}::uuid`);
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  const fuzzy = await flags.enabled("reco.fuzzy_keywords");
  const snapshot = { "reco.v1": await flags.enabled("reco.v1"), "reco.fuzzy_keywords": fuzzy };
  const synonyms = await db.execute(sql`SELECT term,canonical_value AS "canonicalValue",
    category_id AS "categoryId" FROM synonym WHERE status='approved'`);
  const term = normaliseTerm(String(request.description).split(/\s+/)[0] ?? "", synonyms as never,
    request.category_id ? String(request.category_id) : undefined);
  const rows = await db.execute(sql`SELECT d.id AS design_id,d.category_id,d.shop_id,d.status AS design_status,
    d.attributes,s.district_id,s.listing_status,s.response_rate,s.rating_score,
    ss.muted_categories,loc.distance_km,stock.free_units,stock.total_units,
    stock.blocked_with_buffer,
    similarity(d.name,${term}) AS name_similarity,similarity(d.description,${term}) AS description_similarity,
    COALESCE((SELECT max(similarity(t.value,${term})) FROM tag t WHERE t.entity_type='design'
      AND t.entity_id=d.id AND t.field='keyword' AND t.status='confirmed'),0) AS tag_similarity
    FROM design d JOIN shop s ON s.id=d.shop_id JOIN shop_settings ss ON ss.shop_id=s.id
    JOIN category c ON c.id=d.category_id LEFT JOIN branch b ON b.shop_id=s.id
    JOIN LATERAL (SELECT CASE WHEN b.lat IS NULL OR b.lng IS NULL
      OR ${request.center_lat}::float8 IS NULL OR ${request.center_lng}::float8 IS NULL THEN NULL
      ELSE 6371*acos(least(1,greatest(-1,cos(radians(${request.center_lat}::float8))*
        cos(radians(b.lat))*cos(radians(b.lng)-radians(${request.center_lng}::float8))+
        sin(radians(${request.center_lat}::float8))*sin(radians(b.lat))))) END AS distance_km) loc ON true
    JOIN LATERAL (SELECT count(u.id)::int AS total_units,
      count(u.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM availability_block ab
        WHERE ab.unit_id=u.id AND ab.time_range && tstzrange(
          ${request.event_start}::timestamptz-COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day',
          ${request.return_end}::timestamptz+COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day','[)')))::int AS free_units,
      bool_or(EXISTS (SELECT 1 FROM availability_block ab WHERE ab.unit_id=u.id
        AND ab.time_range && tstzrange(
          ${request.event_start}::timestamptz-COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day',
          ${request.return_end}::timestamptz+COALESCE(s.buffer_override_days,c.default_buffer_days)*interval '1 day','[)')
        AND NOT ab.time_range && tstzrange(${request.event_start}::timestamptz,
          ${request.return_end}::timestamptz,'[)'))) AS blocked_with_buffer
      FROM unit u WHERE u.design_id=d.id AND u.branch_id=b.id) stock ON true`);
  const criteria: Criteria = {
    categoryId: request.category_id ? String(request.category_id) : undefined,
    districtId: String(request.district_id),
    maxDistanceKm: request.max_distance_km === null ?
      (request.radius_km === null ? undefined : Number(request.radius_km)) : Number(request.max_distance_km),
    sizeRange: (request.answers as Record<string, string>).size_range,
    attributes: request.answers as Record<string, string>,
    fuzzy, fuzzyThreshold: config.similarityThreshold
  };
  const candidates: Candidate[] = rows.map(row => ({
    shopId: String(row.shop_id), designId: String(row.design_id), categoryId: String(row.category_id),
    districtId: String(row.district_id), distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    shopPublished: row.listing_status === "published", designPublished: row.design_status === "published",
    mutedCategories: (row.muted_categories as string[]) ?? [],
    sizeRange: (row.attributes as Record<string, string>).size_range,
    attributes: row.attributes as Record<string, string>, freeUnits: Number(row.free_units),
    blockedWithBuffer: row.blocked_with_buffer === true, responseRate: Number(row.response_rate ?? 0),
    rating: Number(row.rating_score ?? 0),
    keywordMatches: [
      { field: "name", value: term, similarity: Number(row.name_similarity) },
      { field: "description", value: term, similarity: Number(row.description_similarity) },
      { field: "keyword", value: term, similarity: Number(row.tag_similarity) }
    ]
  }));
  const { eligible, excluded } = rank(candidates, criteria);
  const seen = new Set<string>();
  const shown = eligible.filter(e => {
    if (e.rawScore < config.minRelevance || seen.has(e.item.shopId)) return false;
    seen.add(e.item.shopId); return true;
  }).slice(0, config.recommendationShops);
  if (record) await db.transaction(async tx => {
    await tx.execute(sql`DELETE FROM recommendation WHERE request_id=${requestId}::uuid`);
    for (const { item, code } of excluded) await tx.execute(sql`
      INSERT INTO recommendation(request_id,shop_id,design_id,exclusion_reasons,flag_snapshot)
      VALUES (${requestId}::uuid,${item.shopId}::uuid,${item.designId}::uuid,
        ${JSON.stringify([code])}::jsonb,${JSON.stringify(snapshot)}::jsonb)`);
    for (const [i, { item, rawScore, reasons }] of shown.entries()) {
      await tx.execute(sql`INSERT INTO recommendation(request_id,shop_id,design_id,
        raw_score,rank,reasons,shown_at,flag_snapshot) VALUES
        (${requestId}::uuid,${item.shopId}::uuid,${item.designId}::uuid,${rawScore},
          ${i + 1},${JSON.stringify(reasons)}::jsonb,now(),${JSON.stringify(snapshot)}::jsonb)`);
      await tx.execute(sql`INSERT INTO event(actor,type,subject,payload,flag_snapshot) VALUES
        (${request.customer_id},'recommendation.shown',${item.shopId},
          ${JSON.stringify({ requestId, designId: item.designId, rawScore, reasons, criteria })}::jsonb,
          ${JSON.stringify(snapshot)}::jsonb)`);
    }
  });
  return { shown: shown.map(({ item, rawScore, reasons }) =>
    ({ shopId: item.shopId, designId: item.designId, rawScore, reasons })),
    excluded: excluded.map(({ item, code }) => ({ designId: item.designId, reason: code })),
    snapshot };
}

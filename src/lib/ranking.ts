export const exclusions = [
  "CATEGORY_MISMATCH", "OUT_OF_DISTRICT", "OUT_OF_RANGE", "LISTING_PAUSED",
  "CATEGORY_MUTED", "SIZE_MISMATCH", "UNAVAILABLE_WITH_BUFFER", "NO_FREE_UNIT"
] as const;
export type Exclusion = typeof exclusions[number];
export type Candidate = {
  shopId: string; designId: string; categoryId: string; districtId: string;
  distanceKm: number | null; shopPublished: boolean; designPublished: boolean;
  mutedCategories: string[]; sizeRange?: string; freeUnits: number;
  blockedWithBuffer: boolean; attributes: Record<string, string>;
  keywordMatches: { field: string; value: string; similarity: number }[];
  responseRate?: number | null; rating?: number | null
};
export type Criteria = {
  categoryId?: string; districtId: string; maxDistanceKm?: number;
  sizeRange?: string; attributes: Record<string, string>;
  fuzzy: boolean; fuzzyThreshold: number
};
export type Reason = { field: string; value: string; points: number };
export function firstExclusion(item: Candidate, request: Criteria): Exclusion | null {
  if (request.categoryId && item.categoryId !== request.categoryId) return "CATEGORY_MISMATCH";
  if (item.districtId !== request.districtId) return "OUT_OF_DISTRICT";
  if (request.maxDistanceKm !== undefined &&
    (item.distanceKm === null || item.distanceKm > request.maxDistanceKm)) return "OUT_OF_RANGE";
  if (!item.shopPublished || !item.designPublished) return "LISTING_PAUSED";
  if (item.mutedCategories.includes(item.categoryId)) return "CATEGORY_MUTED";
  if (request.sizeRange && item.sizeRange !== request.sizeRange) return "SIZE_MISMATCH";
  if (item.blockedWithBuffer) return "UNAVAILABLE_WITH_BUFFER";
  if (item.freeUnits < 1) return "NO_FREE_UNIT";
  return null;
}
export function score(item: Candidate, request: Criteria) {
  const reasons: Reason[] = [];
  if (request.categoryId === item.categoryId) reasons.push({ field: "category", value: item.categoryId, points: 2 });
  for (const [field, value] of Object.entries(request.attributes)) {
    if (item.attributes[field] === value) reasons.push({ field, value, points: 2 });
  }
  if (request.fuzzy) for (const match of item.keywordMatches) {
    if (match.similarity >= request.fuzzyThreshold)
      reasons.push({ field: match.field, value: match.value, points: 1 });
  }
  return { rawScore: reasons.reduce((total, reason) => total + reason.points, 0), reasons };
}
export function rank(items: Candidate[], request: Criteria) {
  const excluded: { item: Candidate; code: Exclusion }[] = [];
  const eligible: { item: Candidate; rawScore: number; reasons: Reason[] }[] = [];
  for (const item of items) {
    const code = firstExclusion(item, request);
    if (code) excluded.push({ item, code });
    else eligible.push({ item, ...score(item, request) });
  }
  eligible.sort((a, b) => b.rawScore - a.rawScore ||
    (b.item.responseRate ?? 0) - (a.item.responseRate ?? 0) ||
    (b.item.rating ?? 0) - (a.item.rating ?? 0) ||
    (a.item.distanceKm ?? Infinity) - (b.item.distanceKm ?? Infinity));
  return { eligible, excluded };
}

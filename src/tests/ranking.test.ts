import { describe, expect, it } from "vitest";
import { firstExclusion, exclusions, rank, type Candidate, type Criteria } from "../lib/ranking";
const base: Candidate = { shopId: "s", designId: "d", categoryId: "c", districtId: "district",
  distanceKm: 1, shopPublished: true, designPublished: true, mutedCategories: [], sizeRange: "medium",
  freeUnits: 1, blockedWithBuffer: false, attributes: { colour: "red" }, keywordMatches: [] };
const criteria: Criteria = { categoryId: "c", districtId: "district", maxDistanceKm: 10,
  sizeRange: "medium", attributes: { colour: "red" }, fuzzy: false, fuzzyThreshold: 0.45 };
describe("hard filters before ranking", () => {
  const changes: { code: typeof exclusions[number]; item?: Partial<Candidate>; criteria?: Partial<Criteria> }[] = [
    { code: "CATEGORY_MISMATCH", item: { categoryId: "other" } },
    { code: "OUT_OF_DISTRICT", item: { districtId: "other" } },
    { code: "OUT_OF_RANGE", item: { distanceKm: 20 } },
    { code: "LISTING_PAUSED", item: { shopPublished: false } },
    { code: "CATEGORY_MUTED", item: { mutedCategories: ["c"] } },
    { code: "SIZE_MISMATCH", item: { sizeRange: "small" } },
    { code: "UNAVAILABLE_WITH_BUFFER", item: { blockedWithBuffer: true } },
    { code: "NO_FREE_UNIT", item: { freeUnits: 0 } }
  ];
  for (const { code, item, criteria: change } of changes)
    it(`stores ${code}`, () => expect(firstExclusion({ ...base, ...item }, { ...criteria, ...change })).toBe(code));
  it("does not score an excluded candidate", () => {
    const result = rank([{ ...base, shopPublished: false, keywordMatches: [{ field: "name", value: "dress", similarity: 1 }] }],
      { ...criteria, fuzzy: true });
    expect(result.eligible).toHaveLength(0);
    expect(result.excluded[0].code).toBe("LISTING_PAUSED");
  });
  it("uses response rate, rating, then distance only as tie breakers", () => {
    const result = rank([{ ...base, shopId: "a", responseRate: 0.2 },
      { ...base, shopId: "b", responseRate: 0.9 }], criteria);
    expect(result.eligible[0].item.shopId).toBe("b");
  });
});

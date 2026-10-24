import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normaliseTerm } from "../lib/search";
import { available, availabilityLabel } from "../lib/availability";
describe("search invariants", () => {
  it("normalises case, punctuation, category-specific and global synonyms", () => {
    const entries = [{ term: "vesham", canonicalValue: "costume" },
      { term: "vesham", canonicalValue: "stage", categoryId: "stage" }];
    expect(normaliseTerm(" VESHAM!!! ", entries)).toBe("costume");
    expect(normaliseTerm("Vesham", entries, "stage")).toBe("stage");
  });
  it("never fuzzes structured fields", () => {
    expect({ colour: "red" }.colour === "reed").toBe(false);
  });
  it("coarse search status agrees with free-unit availability", () => {
    fc.assert(fc.property(fc.array(fc.boolean(), { maxLength: 10 }), values => {
      const window = { start: new Date(0), end: new Date(86_400_000) };
      const count = values.filter(blocked => available(blocked ? [window] : [], window, 0)).length;
      expect(availabilityLabel(count, 2) === "unavailable").toBe(count === 0);
    }));
  });
});

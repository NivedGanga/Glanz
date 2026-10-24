import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { available, buffered, localToUtc, overlaps } from "../lib/availability";

describe("availability", () => {
  it("has symmetric overlap and no double booking for a conflicting rental", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 1, max: 30 }),
      (start, length) => {
        const window = { start: new Date(start * 86_400_000), end: new Date((start + length) * 86_400_000) };
        expect(available([window], window, 0)).toBe(false);
        expect(overlaps(window, buffered(window, 1))).toBe(true);
      }));
  });
  it("handles DST with a test-only America/New_York district", () => {
    const before = localToUtc("2026-03-07T12:00", "America/New_York");
    const after = localToUtc("2026-03-09T12:00", "America/New_York");
    expect(after.getTime() - before.getTime()).toBe(47 * 3_600_000);
    expect(() => localToUtc("2026-03-08T02:30", "America/New_York")).toThrow("NONEXISTENT_LOCAL_DATE");
    expect(() => localToUtc("2026-11-01T01:30", "America/New_York")).toThrow("AMBIGUOUS_LOCAL_DATE");
  });
});

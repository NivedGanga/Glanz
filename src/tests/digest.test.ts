import { describe, expect, it } from "vitest";
import { capAllows, inQuietHours } from "../lib/digest";
describe("digest limits", () => {
  it("enforces daily and monthly caps server-side", () => {
    expect(capAllows(3, 4, 3, 30)).toBe(false);
    expect(capAllows(1, 30, 3, 30)).toBe(false);
    expect(capAllows(1, 4, 3, 30)).toBe(true);
  });
  it("interprets overnight quiet hours in the district timezone", () => {
    expect(inQuietHours(new Date("2026-01-01T03:00:00Z"), "America/New_York", "21:00", "09:00")).toBe(true);
    expect(inQuietHours(new Date("2026-01-01T17:00:00Z"), "America/New_York", "21:00", "09:00")).toBe(false);
  });
});

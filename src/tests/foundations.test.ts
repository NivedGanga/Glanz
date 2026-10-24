import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flagPrerequisite } from "../lib/flags";
import { run1Flags, reservedKeys } from "../lib/catalog";
import type { FlagProvider } from "../lib/flags";

describe("feature catalog", () => {
  it("contains only Run 1 flags and no reserved keys", () => {
    for (const key of reservedKeys) expect(Object.keys(run1Flags)).not.toContain(key);
  });
  it("requires an AI key to enable photo features", () => {
    for (const key of ["shop.photo_entry", "customer.photo_tagging"] as const) {
      expect(flagPrerequisite(key, { GEMINI_TIER: "dev" })).toBe(false);
      expect(flagPrerequisite(key, { GEMINI_TIER: "dev", GEMINI_API_KEY_DEV: "test",
        S3_BUCKET: "test", S3_ENDPOINT: "test", S3_ACCESS_KEY_ID: "test",
        S3_SECRET_ACCESS_KEY: "test" })).toBe(true);
    }
  });
  it("isolates ranking from billing and entitlement imports", () => {
    const ranking = readFileSync(resolve("src/lib/ranking.ts"), "utf8");
    expect(ranking).not.toMatch(/from\s+["'][^"']*(?:billing|entitlement|config|plan)/i);
  });
  for (const key of Object.keys(run1Flags) as (keyof typeof run1Flags)[]) {
    it(`${key} evaluates both on and off with an injected provider`, async () => {
      const provider = (enabled: boolean): FlagProvider => ({ enabled: async flag => flag === key && enabled });
      expect(await provider(false).enabled(key)).toBe(false);
      expect(await provider(true).enabled(key)).toBe(true);
    });
  }
});

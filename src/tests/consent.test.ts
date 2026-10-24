import { describe, expect, it } from "vitest";
import { shouldAnalyseRequestPhoto } from "../lib/consent";
describe("request photo consent", () => {
  it("never invokes the AI adapter without explicit live consent", async () => {
    let calls = 0;
    const fake = { analyse: async () => { calls++; } };
    for (const consent of [null, { withdrawnAt: new Date() }]) {
      if (shouldAnalyseRequestPhoto(true, consent)) await fake.analyse();
    }
    expect(calls).toBe(0);
    expect(shouldAnalyseRequestPhoto(true, { withdrawnAt: null })).toBe(true);
    expect(shouldAnalyseRequestPhoto(false, { withdrawnAt: null })).toBe(false);
  });
});

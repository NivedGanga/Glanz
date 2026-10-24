import { describe, expect, it, vi } from "vitest";
import { allowedTags, FakeTagger, GeminiTagger } from "../lib/photo-analysis";
describe("photo suggestions", () => {
  it("drops values outside the allowed list", () => {
    expect(allowedTags({ colour: ["red", "infrared"] }, { colour: ["red"] }))
      .toEqual([{ field: "colour", value: "red" }]);
  });
  it("never sends a real photo using the development key", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(new GeminiTagger("dev", "test").analyse({ bytes: new Uint8Array(), isSynthetic: false }, {}))
      .rejects.toThrow("DEV_KEY_REAL_PHOTO_REFUSED");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
  it("suggests allowed synthetic tags without an external call", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const fake = new FakeTagger();
    expect(await fake.analyse({ bytes: new Uint8Array(), isSynthetic: true }, { colour: ["red", "blue"] }))
      .toEqual([{ field: "colour", value: "red" }]);
    await expect(fake.analyse({ bytes: new Uint8Array(), isSynthetic: false }, {}))
      .rejects.toThrow("FAKE_TAGGER_REAL_PHOTO_REFUSED");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});

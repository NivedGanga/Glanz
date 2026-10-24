import { describe, expect, it } from "vitest";
import { validateAttributes } from "../lib/attributes";
import { digest } from "../lib/tokens";

describe("inventory validation", () => {
  it("accepts only schema-defined attribute values", () => {
    expect(validateAttributes({ colour: ["red"] }, { colour: "red" })).toEqual({ colour: "red" });
    expect(() => validateAttributes({ colour: ["red"] }, { colour: "blue" })).toThrow("INVALID_ATTRIBUTE");
  });
  it("stores only a hash of catalog tokens", () => {
    expect(digest("secret")).not.toContain("secret");
  });
});

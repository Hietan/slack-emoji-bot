import { describe, expect, it } from "vitest";
import { parseEmojiConfig } from "../../src/config/emoji-config.js";

const valid = {
  schemaVersion: 1,
  candidates: [
    { name: "eyes", kind: "standard", description: "a" },
    { name: "white_check_mark", kind: "standard", description: "a" },
    { name: "tada", kind: "standard", description: "a" },
    { name: "pray", kind: "standard", description: "a" },
    { name: "bulb", kind: "standard", description: "a" },
    { name: "rocket", kind: "standard", description: "a" }
  ],
  fallback: ["eyes", "white_check_mark", "tada"]
};

describe("parseEmojiConfig", () => {
  it("accepts a valid config", () => {
    expect(parseEmojiConfig(valid).fallback).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("rejects duplicate candidate names and custom fallback", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        candidates: [...valid.candidates, { name: "eyes", kind: "standard", description: "a" }]
      })
    ).toThrow(/duplicate/u);
    expect(() =>
      parseEmojiConfig({
        ...valid,
        candidates: valid.candidates.map((candidate) => (candidate.name === "tada" ? { ...candidate, kind: "custom" } : candidate))
      })
    ).toThrow(/standard/u);
  });
});

import { describe, expect, it } from "vitest";
import { parseEmojiConfig } from "../../src/config/emoji-config.js";

const valid = {
  version: 1,
  fallback: ["eyes", "white_check_mark", "tada"]
  ,
  emojis: [
    { name: "eyes", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" },
    { name: "white_check_mark", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" },
    { name: "tada", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" },
    { name: "pray", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" },
    { name: "bulb", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" },
    { name: "rocket", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" }
  ]
};

describe("parseEmojiConfig", () => {
  it("accepts a valid config", () => {
    expect(parseEmojiConfig(valid).fallback).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("rejects duplicate candidate names and custom fallback", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: [...valid.emojis, { name: "eyes", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" }]
      })
    ).toThrow(/duplicate/u);
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: valid.emojis.map((candidate) => (candidate.name === "tada" ? { ...candidate, kind: "custom" } : candidate))
      })
    ).toThrow(/standard/u);
  });

  it("rejects configs with too few enabled candidates", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: valid.emojis.map((candidate, index) => (index < 2 ? { ...candidate, enabled: false } : candidate))
      })
    ).toThrow(/at least 6/u);
  });
});

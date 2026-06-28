import { describe, expect, it } from "vitest";
import { parseEmojiConfig } from "../../src/config/emoji-config.js";

function omitAvoidWhen(candidate: (typeof valid.emojis)[number]) {
  return {
    name: candidate.name,
    kind: candidate.kind,
    enabled: candidate.enabled,
    description: candidate.description,
    use_when: candidate.use_when
  };
}

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

  it("accepts candidates without optional avoid_when", () => {
    const parsed = parseEmojiConfig({
      ...valid,
      emojis: valid.emojis.map(omitAvoidWhen)
    });

    expect(parsed.candidates.every((candidate) => candidate.avoidWhen === "")).toBe(true);
  });

  it("rejects duplicate candidate names and accepts custom fallback", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: [...valid.emojis, { name: "eyes", kind: "standard", enabled: true, description: "a", use_when: "when", avoid_when: "avoid" }]
      })
    ).toThrow(/duplicate/u);
    expect(
      parseEmojiConfig({
        ...valid,
        emojis: valid.emojis.map((candidate) => (candidate.name === "tada" ? { ...candidate, kind: "custom" } : candidate))
      }).fallback
    ).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("rejects duplicate names even when one candidate is disabled", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: [...valid.emojis, { ...valid.emojis[0], enabled: false }]
      })
    ).toThrow(/duplicate/u);
  });

  it("rejects configs with too few enabled candidates", () => {
    expect(() =>
      parseEmojiConfig({
        ...valid,
        emojis: valid.emojis.map((candidate, index) => (index < 2 ? { ...candidate, enabled: false } : candidate))
      })
    ).toThrow(/at least 6/u);
  });

  it("rejects fallback lists that are not exactly three entries", () => {
    expect(() => parseEmojiConfig({ ...valid, fallback: ["eyes", "white_check_mark"] })).toThrow();
    expect(() => parseEmojiConfig({ ...valid, fallback: ["eyes", "white_check_mark", "tada", "pray"] })).toThrow();
  });
});

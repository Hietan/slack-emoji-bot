import { readFileSync } from "node:fs";
import { z } from "zod";
import YAML from "yaml";
import type { EmojiConfig } from "../domain/emoji.js";
import { emojiNameSchema, REACTION_COUNT } from "../domain/emoji.js";

const candidateSchema = z.object({
  name: emojiNameSchema,
  kind: z.enum(["standard", "custom"]),
  enabled: z.boolean().default(true),
  description: z.string().min(1).max(160)
    .or(z.string().min(1).max(240)),
  use_when: z.string().min(1).max(240),
  avoid_when: z.string().min(1).max(240)
});

const emojiConfigSchema = z.object({
  version: z.literal(1),
  fallback: z.array(emojiNameSchema).length(REACTION_COUNT)
    .or(z.array(emojiNameSchema).min(1)),
  emojis: z.array(candidateSchema).min(6)
});

export function parseEmojiConfig(input: unknown): EmojiConfig {
  const parsed = emojiConfigSchema.parse(input);
  const names = new Set<string>();
  const enabledCandidates = parsed.emojis.filter((candidate) => candidate.enabled);
  if (enabledCandidates.length < 6) {
    throw new Error("enabled emoji candidates must be at least 6");
  }
  for (const candidate of enabledCandidates) {
    if (names.has(candidate.name)) {
      throw new Error(`duplicate emoji candidate: ${candidate.name}`);
    }
    names.add(candidate.name);
  }
  const fallbackSet = new Set(parsed.fallback);
  if (fallbackSet.size !== REACTION_COUNT) {
    throw new Error("fallback emoji must be distinct");
  }
  for (const fallbackName of parsed.fallback) {
    const candidate = enabledCandidates.find((item) => item.name === fallbackName);
    if (candidate === undefined) {
      throw new Error(`fallback emoji is not a candidate: ${fallbackName}`);
    }
    if (candidate.kind !== "standard") {
      throw new Error(`fallback emoji must be standard: ${fallbackName}`);
    }
  }
  return {
    candidates: enabledCandidates.map((candidate) => ({
      name: candidate.name,
      kind: candidate.kind,
      description: candidate.description,
      useWhen: candidate.use_when,
      avoidWhen: candidate.avoid_when
    })),
    fallback: parsed.fallback
  };
}

export function loadEmojiConfig(path = "config/emoji.default.yaml"): EmojiConfig {
  return parseEmojiConfig(YAML.parse(readFileSync(path, "utf8")));
}

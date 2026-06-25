import { readFileSync } from "node:fs";
import { z } from "zod";
import YAML from "yaml";
import type { EmojiConfig } from "../domain/emoji.js";
import { emojiNameSchema, REACTION_COUNT } from "../domain/emoji.js";

const candidateSchema = z.object({
  name: emojiNameSchema,
  kind: z.enum(["standard", "custom"]),
  description: z.string().min(1).max(160)
});

const emojiConfigSchema = z.object({
  schemaVersion: z.literal(1),
  candidates: z.array(candidateSchema).min(6),
  fallback: z.array(emojiNameSchema).length(REACTION_COUNT)
});

export function parseEmojiConfig(input: unknown): EmojiConfig {
  const parsed = emojiConfigSchema.parse(input);
  const names = new Set<string>();
  for (const candidate of parsed.candidates) {
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
    const candidate = parsed.candidates.find((item) => item.name === fallbackName);
    if (candidate === undefined) {
      throw new Error(`fallback emoji is not a candidate: ${fallbackName}`);
    }
    if (candidate.kind !== "standard") {
      throw new Error(`fallback emoji must be standard: ${fallbackName}`);
    }
  }
  return {
    candidates: parsed.candidates,
    fallback: parsed.fallback
  };
}

export function loadEmojiConfig(path = "config/emoji.default.yaml"): EmojiConfig {
  return parseEmojiConfig(YAML.parse(readFileSync(path, "utf8")));
}

import { z } from "zod";

export const REACTION_COUNT = 3;

export const emojiNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_+-]+$/u);

export type EmojiKind = "standard" | "custom";

export type EmojiCandidate = {
  name: string;
  kind: EmojiKind;
  description: string;
};

export type EmojiConfig = {
  candidates: EmojiCandidate[];
  fallback: string[];
};

export type EmojiSelectionSource = "gemini" | "fallback";

export type EmojiSelection = {
  names: [string, string, string];
  source: EmojiSelectionSource;
};

export function uniqueThree(names: string[]): [string, string, string] | null {
  if (names.length !== REACTION_COUNT) {
    return null;
  }
  const unique = new Set(names);
  if (unique.size !== REACTION_COUNT) {
    return null;
  }
  const first = names[0];
  const second = names[1];
  const third = names[2];
  if (first === undefined || second === undefined || third === undefined) {
    return null;
  }
  return [first, second, third];
}

export function validateSelection(names: string[], allowlist: ReadonlySet<string>): [string, string, string] | null {
  const selected = uniqueThree(names);
  if (selected === null) {
    return null;
  }
  return selected.every((name) => allowlist.has(name)) ? selected : null;
}

export function selectFallback(config: EmojiConfig, allowlist: ReadonlySet<string>): EmojiSelection {
  const selected = validateSelection(
    config.fallback.filter((name) => allowlist.has(name)).slice(0, REACTION_COUNT),
    allowlist
  );
  if (selected === null) {
    throw new Error("fallback_candidates_unavailable");
  }
  return { names: selected, source: "fallback" };
}

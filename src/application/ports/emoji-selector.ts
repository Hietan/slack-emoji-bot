import type { EmojiCandidate, EmojiSelection } from "../../domain/emoji.js";

export type EmojiSelector = {
  select(input: {
    analysisText: string;
    candidates: EmojiCandidate[];
  }): Promise<EmojiSelection>;
};

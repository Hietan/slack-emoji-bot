import type { ReactionResult } from "../../domain/errors.js";

export type ReactionClient = {
  addReaction(input: {
    channelId: string;
    messageTs: string;
    emojiName: string;
  }): Promise<ReactionResult>;
};

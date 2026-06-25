import type { EmojiSelectionSource } from "./emoji.js";

export type ProcessStatus = "processing" | "completed" | "permanent_error";

export type ProcessRecord = {
  eventId: string;
  status: ProcessStatus;
  teamId: string;
  apiAppId: string;
  channelId: string;
  messageTs: string;
  textSha256: string;
  selectedEmojiNames: [string, string, string] | null;
  selectionSource: EmojiSelectionSource | null;
  completedEmojiNames: string[];
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  attempts: number;
  dryRun: boolean;
  createdAt: Date;
  updatedAt: Date;
};

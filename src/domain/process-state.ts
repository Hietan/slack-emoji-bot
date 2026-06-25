import type { EmojiSelectionSource } from "./emoji.js";

export type ProcessStatus = "processing" | "retryable_error" | "completed" | "permanent_error";

export type ProcessLastError = {
  stage: "gemini" | "emoji_catalog" | "slack" | "firestore" | "unknown";
  code: string;
  retryable: boolean;
  occurredAt: Date;
};

export type ProcessRecord = {
  schemaVersion: 1;
  eventId: string;
  status: ProcessStatus;
  teamId: string;
  apiAppId: string;
  channelId: string;
  messageTs: string;
  textSha256: string;
  selectedEmojis: [string, string, string] | null;
  selectionSource: EmojiSelectionSource | null;
  completedEmojis: string[];
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  attemptCount: number;
  dryRun: boolean;
  lastError: ProcessLastError | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
};

import type { EmojiSelection } from "../../domain/emoji.js";
import type { ProcessRecord } from "../../domain/process-state.js";
import type { TaskPayload } from "../../domain/task-payload.js";

export type LeaseResult =
  | { kind: "acquired"; record: ProcessRecord }
  | { kind: "already_completed"; record: ProcessRecord }
  | { kind: "conflict" };

export type ProcessRepository = {
  acquireLease(payload: TaskPayload, leaseOwner: string, leaseExpiresAt: Date, now: Date): Promise<LeaseResult>;
  persistSelection(eventId: string, selection: EmojiSelection, now: Date): Promise<ProcessRecord>;
  markReactionComplete(eventId: string, emojiName: string, now: Date): Promise<ProcessRecord>;
  markCompleted(eventId: string, dryRun: boolean, now: Date): Promise<ProcessRecord>;
  markPermanentError(eventId: string, code: string, now: Date): Promise<ProcessRecord>;
};

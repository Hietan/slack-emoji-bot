import type { LeaseResult, ProcessRepository } from "../../src/application/ports/process-repository.js";
import type { EmojiSelection } from "../../src/domain/emoji.js";
import type { ProcessRecord } from "../../src/domain/process-state.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";

export class MemoryProcessRepository implements ProcessRepository {
  public readonly records = new Map<string, ProcessRecord>();

  public acquireLease(payload: TaskPayload, leaseOwner: string, leaseExpiresAt: Date, now: Date): Promise<LeaseResult> {
    const existing = this.records.get(payload.eventId);
    if (existing !== undefined) {
      if (existing.status === "completed") {
        return Promise.resolve({ kind: "already_completed", record: existing });
      }
      if (existing.leaseExpiresAt !== null && existing.leaseExpiresAt.getTime() > now.getTime()) {
        return Promise.resolve({ kind: "conflict" });
      }
      const updated = { ...existing, status: "processing" as const, leaseOwner, leaseExpiresAt, attempts: existing.attempts + 1, updatedAt: now };
      this.records.set(payload.eventId, updated);
      return Promise.resolve({ kind: "acquired", record: updated });
    }
    const record: ProcessRecord = {
      eventId: payload.eventId,
      status: "processing",
      teamId: payload.teamId,
      apiAppId: payload.apiAppId,
      channelId: payload.channelId,
      messageTs: payload.messageTs,
      textSha256: payload.textSha256,
      selectedEmojiNames: null,
      selectionSource: null,
      completedEmojiNames: [],
      leaseOwner,
      leaseExpiresAt,
      attempts: 1,
      dryRun: false,
      createdAt: now,
      updatedAt: now
    };
    this.records.set(payload.eventId, record);
    return Promise.resolve({ kind: "acquired", record });
  }

  public persistSelection(eventId: string, selection: EmojiSelection, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = { ...record, selectedEmojiNames: selection.names, selectionSource: selection.source, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markReactionComplete(eventId: string, emojiName: string, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const completedEmojiNames = Array.from(new Set([...record.completedEmojiNames, emojiName]));
    const updated = { ...record, completedEmojiNames, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markCompleted(eventId: string, dryRun: boolean, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = { ...record, status: "completed" as const, dryRun, leaseOwner: null, leaseExpiresAt: null, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markPermanentError(eventId: string, _code: string, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = { ...record, status: "permanent_error" as const, leaseOwner: null, leaseExpiresAt: null, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  private get(eventId: string): ProcessRecord {
    const record = this.records.get(eventId);
    if (record === undefined) {
      throw new Error("missing record");
    }
    return record;
  }
}

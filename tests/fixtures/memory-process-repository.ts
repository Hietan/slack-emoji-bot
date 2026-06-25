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
      if (existing.status === "permanent_error") {
        return Promise.resolve({ kind: "already_completed", record: existing });
      }
      if (existing.leaseExpiresAt !== null && existing.leaseExpiresAt.getTime() > now.getTime()) {
        return Promise.resolve({ kind: "conflict" });
      }
      const updated = {
        ...existing,
        status: "processing" as const,
        leaseOwner,
        leaseExpiresAt,
        attemptCount: existing.attemptCount + 1,
        lastError: null,
        updatedAt: now
      };
      this.records.set(payload.eventId, updated);
      return Promise.resolve({ kind: "acquired", record: updated });
    }
    const record: ProcessRecord = {
      schemaVersion: 1,
      eventId: payload.eventId,
      status: "processing",
      teamId: payload.teamId,
      channelId: payload.channelId,
      messageTs: payload.messageTs,
      textSha256: payload.textSha256,
      selectedEmojis: null,
      selectionSource: null,
      completedEmojis: [],
      leaseOwner,
      leaseExpiresAt,
      attemptCount: 1,
      dryRun: false,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    };
    this.records.set(payload.eventId, record);
    return Promise.resolve({ kind: "acquired", record });
  }

  public persistSelection(eventId: string, selection: EmojiSelection, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = { ...record, selectedEmojis: selection.names, selectionSource: selection.source, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markReactionComplete(eventId: string, emojiName: string, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const completedEmojis = Array.from(new Set([...record.completedEmojis, emojiName]));
    const updated = { ...record, completedEmojis, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markCompleted(eventId: string, dryRun: boolean, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = { ...record, status: "completed" as const, dryRun, leaseOwner: null, leaseExpiresAt: null, completedAt: now, updatedAt: now };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markRetryableError(eventId: string, code: string, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = {
      ...record,
      status: "retryable_error" as const,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: { stage: "slack" as const, code, retryable: true, occurredAt: now },
      updatedAt: now
    };
    this.records.set(eventId, updated);
    return Promise.resolve(updated);
  }

  public markPermanentError(eventId: string, _code: string, now: Date): Promise<ProcessRecord> {
    const record = this.get(eventId);
    const updated = {
      ...record,
      status: "permanent_error" as const,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: { stage: "slack" as const, code: _code, retryable: false, occurredAt: now },
      updatedAt: now
    };
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

import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
import type { LeaseResult, ProcessRepository } from "../application/ports/process-repository.js";
import type { EmojiSelection } from "../domain/emoji.js";
import type { ProcessRecord } from "../domain/process-state.js";
import type { TaskPayload } from "../domain/task-payload.js";
import { sha256Hex } from "../shared/crypto.js";

type StoredRecord = Omit<ProcessRecord, "createdAt" | "updatedAt" | "leaseExpiresAt" | "completedAt" | "expiresAt" | "lastError"> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  leaseExpiresAt: Timestamp | null;
  completedAt: Timestamp | null;
  expiresAt: Timestamp;
  lastError: {
    stage: "gemini" | "emoji_catalog" | "slack" | "firestore" | "unknown";
    code: string;
    retryable: boolean;
    occurredAt: Timestamp;
  } | null;
  permanentErrorCode?: string;
};

export class FirestoreProcessRepository implements ProcessRepository {
  readonly #firestore: Firestore;
  readonly #ttlDays: number;

  public constructor(firestore = new Firestore(), ttlDays = 7) {
    this.#firestore = firestore;
    this.#ttlDays = ttlDays;
  }

  public async acquireLease(payload: TaskPayload, leaseOwner: string, leaseExpiresAt: Date, now: Date): Promise<LeaseResult> {
    const ref = this.#doc(payload.eventId);
    return this.#firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        const record = toRecord(snapshot.data() as StoredRecord);
        if (record.status === "completed" || record.status === "permanent_error") {
          return { kind: "already_completed", record };
        }
        if (record.leaseExpiresAt !== null && record.leaseExpiresAt.getTime() > now.getTime()) {
          return { kind: "conflict" };
        }
        transaction.update(ref, {
          status: "processing",
          leaseOwner,
          leaseExpiresAt: Timestamp.fromDate(leaseExpiresAt),
          attemptCount: FieldValue.increment(1),
          lastError: null,
          updatedAt: Timestamp.fromDate(now)
        });
        return {
          kind: "acquired",
          record: { ...record, status: "processing", leaseOwner, leaseExpiresAt, attemptCount: record.attemptCount + 1, lastError: null, updatedAt: now }
        };
      }
      const record: StoredRecord = {
        schemaVersion: 1,
        eventId: payload.eventId,
        status: "processing",
        teamId: payload.teamId,
        apiAppId: payload.apiAppId,
        channelId: payload.channelId,
        messageTs: payload.messageTs,
        textSha256: payload.textSha256,
        selectedEmojis: null,
        selectionSource: null,
        completedEmojis: [],
        leaseOwner,
        leaseExpiresAt: Timestamp.fromDate(leaseExpiresAt),
        attemptCount: 1,
        dryRun: false,
        lastError: null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        completedAt: null,
        expiresAt: Timestamp.fromDate(new Date(now.getTime() + this.#ttlDays * 24 * 60 * 60 * 1000))
      };
      transaction.create(ref, record);
      return { kind: "acquired", record: toRecord(record) };
    });
  }

  public async persistSelection(eventId: string, selection: EmojiSelection, now: Date): Promise<ProcessRecord> {
    const ref = this.#doc(eventId);
    await ref.update({
      selectedEmojis: selection.names,
      selectionSource: selection.source,
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markReactionComplete(eventId: string, emojiName: string, now: Date): Promise<ProcessRecord> {
    const ref = this.#doc(eventId);
    await ref.update({
      completedEmojis: FieldValue.arrayUnion(emojiName),
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markCompleted(eventId: string, dryRun: boolean, now: Date): Promise<ProcessRecord> {
    const ref = this.#doc(eventId);
    await ref.update({
      status: "completed",
      dryRun,
      leaseOwner: null,
      leaseExpiresAt: null,
      completedAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markRetryableError(eventId: string, code: string, now: Date): Promise<ProcessRecord> {
    const ref = this.#doc(eventId);
    await ref.update({
      status: "retryable_error",
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: {
        stage: "slack",
        code,
        retryable: true,
        occurredAt: Timestamp.fromDate(now)
      },
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markPermanentError(eventId: string, code: string, now: Date): Promise<ProcessRecord> {
    const ref = this.#doc(eventId);
    await ref.update({
      status: "permanent_error",
      permanentErrorCode: code,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: {
        stage: "slack",
        code,
        retryable: false,
        occurredAt: Timestamp.fromDate(now)
      },
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  async #read(eventId: string): Promise<ProcessRecord> {
    const snapshot = await this.#doc(eventId).get();
    if (!snapshot.exists) {
      throw new Error("process_record_not_found");
    }
    return toRecord(snapshot.data() as StoredRecord);
  }

  #doc(eventId: string) {
    return this.#firestore.collection("slackEventProcesses").doc(sha256Hex(eventId));
  }
}

function toRecord(data: StoredRecord): ProcessRecord {
  return {
    ...data,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    leaseExpiresAt: data.leaseExpiresAt?.toDate() ?? null,
    completedAt: data.completedAt?.toDate() ?? null,
    expiresAt: data.expiresAt.toDate(),
    lastError:
      data.lastError === null
        ? null
        : {
            ...data.lastError,
            occurredAt: data.lastError.occurredAt.toDate()
          }
  };
}

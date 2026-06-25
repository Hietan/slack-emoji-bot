import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
import type { LeaseResult, ProcessRepository } from "../application/ports/process-repository.js";
import type { EmojiSelection } from "../domain/emoji.js";
import type { ProcessRecord } from "../domain/process-state.js";
import type { TaskPayload } from "../domain/task-payload.js";

type StoredRecord = Omit<ProcessRecord, "createdAt" | "updatedAt" | "leaseExpiresAt"> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  leaseExpiresAt: Timestamp | null;
  permanentErrorCode?: string;
};

export class FirestoreProcessRepository implements ProcessRepository {
  readonly #firestore: Firestore;

  public constructor(firestore = new Firestore()) {
    this.#firestore = firestore;
  }

  public async acquireLease(payload: TaskPayload, leaseOwner: string, leaseExpiresAt: Date, now: Date): Promise<LeaseResult> {
    const ref = this.#firestore.collection("slackEventProcesses").doc(payload.eventId);
    return this.#firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        const record = toRecord(snapshot.data() as StoredRecord);
        if (record.status === "completed") {
          return { kind: "already_completed", record };
        }
        if (record.leaseExpiresAt !== null && record.leaseExpiresAt.getTime() > now.getTime()) {
          return { kind: "conflict" };
        }
        transaction.update(ref, {
          status: "processing",
          leaseOwner,
          leaseExpiresAt: Timestamp.fromDate(leaseExpiresAt),
          attempts: FieldValue.increment(1),
          updatedAt: Timestamp.fromDate(now)
        });
        return {
          kind: "acquired",
          record: { ...record, status: "processing", leaseOwner, leaseExpiresAt, attempts: record.attempts + 1, updatedAt: now }
        };
      }
      const record: StoredRecord = {
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
        leaseExpiresAt: Timestamp.fromDate(leaseExpiresAt),
        attempts: 1,
        dryRun: false,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };
      transaction.create(ref, record);
      return { kind: "acquired", record: toRecord(record) };
    });
  }

  public async persistSelection(eventId: string, selection: EmojiSelection, now: Date): Promise<ProcessRecord> {
    const ref = this.#firestore.collection("slackEventProcesses").doc(eventId);
    await ref.update({
      selectedEmojiNames: selection.names,
      selectionSource: selection.source,
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markReactionComplete(eventId: string, emojiName: string, now: Date): Promise<ProcessRecord> {
    const ref = this.#firestore.collection("slackEventProcesses").doc(eventId);
    await ref.update({
      completedEmojiNames: FieldValue.arrayUnion(emojiName),
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markCompleted(eventId: string, dryRun: boolean, now: Date): Promise<ProcessRecord> {
    const ref = this.#firestore.collection("slackEventProcesses").doc(eventId);
    await ref.update({
      status: "completed",
      dryRun,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  public async markPermanentError(eventId: string, code: string, now: Date): Promise<ProcessRecord> {
    const ref = this.#firestore.collection("slackEventProcesses").doc(eventId);
    await ref.update({
      status: "permanent_error",
      permanentErrorCode: code,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: Timestamp.fromDate(now)
    });
    return this.#read(eventId);
  }

  async #read(eventId: string): Promise<ProcessRecord> {
    const snapshot = await this.#firestore.collection("slackEventProcesses").doc(eventId).get();
    if (!snapshot.exists) {
      throw new Error("process_record_not_found");
    }
    return toRecord(snapshot.data() as StoredRecord);
  }
}

function toRecord(data: StoredRecord): ProcessRecord {
  return {
    ...data,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    leaseExpiresAt: data.leaseExpiresAt?.toDate() ?? null
  };
}

import { describe, expect, it, vi } from "vitest";
import { processSlackEvent } from "../../src/application/process-slack-event.js";
import type { EmojiConfig } from "../../src/domain/emoji.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { MemoryProcessRepository } from "../fixtures/memory-process-repository.js";

const emojiConfig: EmojiConfig = {
  candidates: [
    { name: "eyes", kind: "standard", description: "a" },
    { name: "white_check_mark", kind: "standard", description: "a" },
    { name: "tada", kind: "standard", description: "a" },
    { name: "pray", kind: "standard", description: "a" },
    { name: "bulb", kind: "standard", description: "a" },
    { name: "rocket", kind: "standard", description: "a" }
  ],
  fallback: ["eyes", "white_check_mark", "tada"]
};

const payload: TaskPayload = {
  schemaVersion: 1,
  eventId: "Ev1",
  teamId: "T1",
  apiAppId: "A1",
  eventTime: 1712345678,
  channelId: "C1",
  messageTs: "1712345678.123456",
  analysisText: "hello",
  textSha256: "a".repeat(64),
  receivedAt: "2026-06-25T00:00:00.000Z"
};

const base = {
  config: {
    teamId: "T1",
    apiAppId: "A1",
    targetChannelIds: new Set(["C1"]),
    dryRun: false,
    leaseSeconds: 1
  },
  emojiConfig,
  emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set<string>()) },
  clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
};

describe("processSlackEvent", () => {
  it("persists a selection once and resumes only unfinished reactions", async () => {
    const repository = new MemoryProcessRepository();
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const })) };
    const calls: string[] = [];
    const reactionClient = {
      addReaction: vi.fn(({ emojiName }: { emojiName: string }) => {
        calls.push(emojiName);
        if (emojiName === "white_check_mark" && calls.filter((name) => name === "white_check_mark").length === 1) {
          return Promise.resolve({ ok: false as const, retryable: true, code: "service_unavailable" as const });
        }
        return Promise.resolve({ ok: true as const });
      })
    };

    await expect(processSlackEvent({ ...base, payload, repository, emojiSelector: selector, reactionClient })).resolves.toEqual({ kind: "retryable" });
    const record = repository.records.get("Ev1");
    if (record === undefined) {
      throw new Error("missing test record");
    }
    record.leaseExpiresAt = new Date("2026-06-24T00:00:00.000Z");
    await expect(processSlackEvent({ ...base, payload, repository, emojiSelector: selector, reactionClient })).resolves.toEqual({ kind: "completed" });

    expect(selector.select).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["eyes", "white_check_mark", "white_check_mark", "tada"]);
  });

  it("falls back when Gemini returns invalid names", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "eyes", "nope"] as [string, string, string], source: "gemini" as const })) };
    await processSlackEvent({ ...base, payload: { ...payload, eventId: "Ev2" }, repository, emojiSelector: selector, reactionClient });
    expect(repository.records.get("Ev2")?.selectedEmojiNames).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("marks dry runs complete without calling Slack", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    await processSlackEvent({
      ...base,
      config: { ...base.config, dryRun: true },
      payload: { ...payload, eventId: "Ev3" },
      repository,
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient
    });
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
    expect(repository.records.get("Ev3")?.dryRun).toBe(true);
  });
});

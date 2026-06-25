import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { EmojiConfig } from "../../src/domain/emoji.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { createWorkerApp } from "../../src/worker/app.js";
import { MemoryProcessRepository } from "../fixtures/memory-process-repository.js";

const emojiConfig: EmojiConfig = {
  candidates: [
    { name: "eyes", kind: "standard", description: "a" },
    { name: "white_check_mark", kind: "standard", description: "a" },
    { name: "tada", kind: "standard", description: "a" },
    { name: "pray", kind: "standard", description: "a" },
    { name: "bulb", kind: "standard", description: "a" },
    { name: "rocket", kind: "standard", description: "a" },
    { name: "shipit", kind: "custom", description: "a" }
  ],
  fallback: ["eyes", "white_check_mark", "tada"]
};

const env = {
  PORT: 8080,
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1",
  SLACK_BOT_TOKEN: "xoxb-test",
  GEMINI_API_KEY: "gemini-test",
  GEMINI_MODEL: "gemini-2.5-flash-lite",
  DRY_RUN: false,
  LEASE_SECONDS: 1,
  targetChannelSet: new Set(["C1"])
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

describe("worker app", () => {
  it("processes a task and completes three reactions", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const app = createWorkerApp({
      env,
      emojiConfig,
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set(["shipit"])) },
      emojiSelector: { select: () => Promise.resolve({ names: ["shipit", "eyes", "tada"] as [string, string, string], source: "gemini" as const }) },
      reactionClient,
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    const response = await request(app).post("/tasks/process").send(payload);
    expect(response.status).toBe(204);
    expect(reactionClient.addReaction).toHaveBeenCalledTimes(3);
    expect(repository.records.get("Ev1")?.status).toBe("completed");
  });

  it("falls back when custom emoji catalog is unavailable", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const app = createWorkerApp({
      env,
      emojiConfig,
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.reject(new Error("unavailable")) },
      emojiSelector: { select: () => Promise.reject(new Error("timeout")) },
      reactionClient,
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    const response = await request(app).post("/tasks/process").send({ ...payload, eventId: "Ev2" });
    expect(response.status).toBe(204);
    expect(repository.records.get("Ev2")?.selectedEmojiNames).toEqual(["eyes", "white_check_mark", "tada"]);
  });
});

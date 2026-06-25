import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../src/config/worker-env.js";
import type { EmojiConfig } from "../../src/domain/emoji.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { createWorkerApp } from "../../src/worker/app.js";
import { MemoryProcessRepository } from "../fixtures/memory-process-repository.js";

function emoji(name: string, kind: "standard" | "custom" = "standard") {
  return { name, kind, description: "a", useWhen: "when", avoidWhen: "avoid" };
}

const emojiConfig: EmojiConfig = {
  candidates: [
    emoji("eyes"),
    emoji("white_check_mark"),
    emoji("tada"),
    emoji("pray"),
    emoji("bulb"),
    emoji("rocket"),
    emoji("shipit", "custom")
  ],
  fallback: ["eyes", "white_check_mark", "tada"]
};

const env: WorkerEnv = {
  NODE_ENV: "test",
  PORT: 8080,
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1",
  SLACK_BOT_TOKEN: "test-slack-token",
  GEMINI_API_KEY: "gemini-test",
  GEMINI_MODEL: "gemini-2.5-flash-lite",
  GEMINI_TIMEOUT_MS: 8000,
  SLACK_TIMEOUT_MS: 5000,
  GEMINI_UNPAID_TERMS_ACKNOWLEDGED: true,
  EMOJI_CONFIG_PATH: "config/emoji.default.yaml",
  CUSTOM_EMOJI_CACHE_TTL_SECONDS: 600,
  FIRESTORE_DATABASE_ID: "(default)",
  PROCESS_RECORD_TTL_DAYS: 7,
  DRY_RUN: false,
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
    expect(repository.records.get("Ev2")?.selectedEmojis).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("discards invalid task payloads with 204", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const })) };
    const app = createWorkerApp({
      env,
      emojiConfig,
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set<string>()) },
      emojiSelector: selector,
      reactionClient,
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    const response = await request(app).post("/tasks/process").send({ ...payload, userId: "U1" });
    expect(response.status).toBe(204);
    expect(selector.select).not.toHaveBeenCalled();
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
    expect(repository.records.size).toBe(0);
  });

  it("returns 409 while another worker owns the lease", async () => {
    const repository = new MemoryProcessRepository();
    await repository.acquireLease(payload, "owner-1", new Date("2026-06-25T00:02:00.000Z"), new Date("2026-06-25T00:00:00.000Z"));
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const app = createWorkerApp({
      env,
      emojiConfig,
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set<string>()) },
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const }) },
      reactionClient,
      clock: { now: () => new Date("2026-06-25T00:00:30.000Z") }
    });
    const response = await request(app).post("/tasks/process").send(payload);
    expect(response.status).toBe(409);
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
  });

  it("returns 429 and Retry-After for Slack rate limits", async () => {
    const repository = new MemoryProcessRepository();
    const app = createWorkerApp({
      env,
      emojiConfig,
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set<string>()) },
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: false as const, retryable: true, code: "ratelimited" as const, retryAfterSeconds: 9 }) },
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    const response = await request(app).post("/tasks/process").send({ ...payload, eventId: "EvRateLimited" });
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("9");
  });
});

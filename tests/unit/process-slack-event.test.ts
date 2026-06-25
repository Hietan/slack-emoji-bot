import { describe, expect, it, vi } from "vitest";
import { fallbackSelector, processSlackEvent, standardOnlyCatalog } from "../../src/application/process-slack-event.js";
import type { EmojiCandidate, EmojiConfig } from "../../src/domain/emoji.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { eventIdHash } from "../../src/shared/crypto.js";
import { MemoryProcessRepository } from "../fixtures/memory-process-repository.js";

function slackError(code: string): Error & { data: { error: string } } {
  return Object.assign(new Error(code), { data: { error: code } });
}

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
    emoji("rocket")
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
  it("emits safe observability events for selection and reaction progress", async () => {
    const repository = new MemoryProcessRepository();
    const observed: unknown[] = [];
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };

    await expect(
      processSlackEvent({
        ...base,
        payload,
        repository,
        emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set<string>()) },
        emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
        reactionClient,
        observer: (event) => observed.push(event)
      })
    ).resolves.toEqual({ kind: "completed" });

    expect(observed).toEqual([
      {
        event: "worker_lease_acquired",
        eventIdHash: eventIdHash("Ev1"),
        channelId: "C1",
        messageTs: "1712345678.123456",
        attemptCount: 1
      },
      { event: "gemini_selection_succeeded", eventIdHash: eventIdHash("Ev1"), source: "gemini" },
      { event: "slack_reaction_succeeded", eventIdHash: eventIdHash("Ev1"), emojiName: "eyes", alreadyPresent: false },
      { event: "slack_reaction_succeeded", eventIdHash: eventIdHash("Ev1"), emojiName: "white_check_mark", alreadyPresent: false },
      { event: "slack_reaction_succeeded", eventIdHash: eventIdHash("Ev1"), emojiName: "tada", alreadyPresent: false },
      { event: "worker_completed", eventIdHash: eventIdHash("Ev1"), status: "completed" }
    ]);
    expect(JSON.stringify(observed)).not.toContain("hello");
    expect(JSON.stringify(observed)).not.toContain("analysisText");
  });

  it("emits observability events for invalid, duplicate, dry-run, retryable, and permanent outcomes", async () => {
    const invalidEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, channelId: "C2" },
      repository: new MemoryProcessRepository(),
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) },
      observer: (event) => invalidEvents.push(event)
    });
    expect(invalidEvents).toEqual([{ event: "worker_completed", eventIdHash: eventIdHash("Ev1"), status: "invalid_task" }]);

    const completedRepository = new MemoryProcessRepository();
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedCompleted" },
      repository: completedRepository,
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) }
    });
    const completedEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedCompleted" },
      repository: completedRepository,
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) },
      observer: (event) => completedEvents.push(event)
    });
    expect(completedEvents).toEqual([
      { event: "worker_already_completed", eventIdHash: eventIdHash("EvObservedCompleted"), status: "already_completed" }
    ]);

    const dryRunEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      config: { ...base.config, dryRun: true },
      payload: { ...payload, eventId: "EvObservedDryRun" },
      repository: new MemoryProcessRepository(),
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) },
      observer: (event) => dryRunEvents.push(event)
    });
    expect(dryRunEvents.at(-1)).toEqual({
      event: "worker_completed",
      eventIdHash: eventIdHash("EvObservedDryRun"),
      status: "completed"
    });

    const retryableEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedRetryable" },
      repository: new MemoryProcessRepository(),
      emojiConfig: { candidates: [...emojiConfig.candidates, emoji("shipit", "custom")], fallback: emojiConfig.fallback },
      emojiCatalog: { listCustomEmojiNames: () => Promise.reject(new Error("unavailable")) },
      emojiSelector: { select: () => Promise.reject(new Error("timeout")) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: false as const, retryable: true, code: "service_unavailable" as const }) },
      observer: (event) => retryableEvents.push(event)
    });
    expect(retryableEvents).toContainEqual({
      event: "custom_emoji_catalog_unavailable",
      eventIdHash: eventIdHash("EvObservedRetryable"),
      code: "unavailable"
    });
    expect(retryableEvents).toContainEqual({
      event: "gemini_selection_fallback",
      eventIdHash: eventIdHash("EvObservedRetryable"),
      source: "fallback_gemini_error"
    });
    expect(retryableEvents).toContainEqual({
      event: "slack_reaction_retryable_error",
      eventIdHash: eventIdHash("EvObservedRetryable"),
      code: "service_unavailable"
    });

    const permanentEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedPermanent" },
      repository: new MemoryProcessRepository(),
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: false as const, retryable: false, code: "missing_scope" as const }) },
      observer: (event) => permanentEvents.push(event)
    });
    expect(permanentEvents).toContainEqual({
      event: "slack_reaction_permanent_error",
      eventIdHash: eventIdHash("EvObservedPermanent"),
      code: "missing_scope"
    });

    const missingCustomEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedMissingCustom" },
      repository: new MemoryProcessRepository(),
      emojiConfig: {
        candidates: [...emojiConfig.candidates, emoji("shipit", "custom"), emoji("nice_research", "custom")],
        fallback: emojiConfig.fallback
      },
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set(["shipit"])) },
      emojiSelector: { select: () => Promise.reject(new Error("timeout")) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) },
      observer: (event) => missingCustomEvents.push(event)
    });
    expect(missingCustomEvents).toContainEqual({
      event: "custom_emoji_candidates_missing",
      eventIdHash: eventIdHash("EvObservedMissingCustom"),
      emojiNames: ["nice_research"]
    });

    const missingScopeEvents: unknown[] = [];
    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvObservedMissingScope" },
      repository: new MemoryProcessRepository(),
      emojiConfig: { candidates: [...emojiConfig.candidates, emoji("shipit", "custom")], fallback: emojiConfig.fallback },
      emojiCatalog: { listCustomEmojiNames: () => Promise.reject(slackError("missing_scope")) },
      emojiSelector: { select: () => Promise.reject(new Error("timeout")) },
      reactionClient: { addReaction: () => Promise.resolve({ ok: true as const }) },
      observer: (event) => missingScopeEvents.push(event)
    });
    expect(missingScopeEvents).toContainEqual({
      event: "custom_emoji_catalog_unavailable",
      eventIdHash: eventIdHash("EvObservedMissingScope"),
      code: "missing_scope"
    });
  });

  it("rejects tasks that no longer match worker configuration before acquiring a lease", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const })) };

    await expect(
      processSlackEvent({
        ...base,
        payload: { ...payload, channelId: "C2" },
        repository,
        emojiSelector: selector,
        reactionClient
      })
    ).resolves.toEqual({ kind: "invalid_task" });

    expect(repository.records.size).toBe(0);
    expect(selector.select).not.toHaveBeenCalled();
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
  });

  it("returns lease conflicts without calling Gemini or Slack", async () => {
    const repository = new MemoryProcessRepository();
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const })) };
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    await repository.acquireLease(payload, "owner-1", new Date("2026-06-25T00:02:00.000Z"), base.clock.now());

    await expect(processSlackEvent({ ...base, payload, repository, emojiSelector: selector, reactionClient })).resolves.toEqual({ kind: "lease_conflict" });

    expect(selector.select).not.toHaveBeenCalled();
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
  });

  it("does not reprocess completed records", async () => {
    const repository = new MemoryProcessRepository();
    const selector = { select: vi.fn(() => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"] as [string, string, string], source: "gemini" as const })) };
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    await processSlackEvent({ ...base, payload: { ...payload, eventId: "EvCompleted" }, repository, emojiSelector: selector, reactionClient });
    selector.select.mockClear();
    reactionClient.addReaction.mockClear();

    await expect(processSlackEvent({ ...base, payload: { ...payload, eventId: "EvCompleted" }, repository, emojiSelector: selector, reactionClient })).resolves.toEqual({
      kind: "already_completed"
    });

    expect(selector.select).not.toHaveBeenCalled();
    expect(reactionClient.addReaction).not.toHaveBeenCalled();
  });

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
    expect(record.status).toBe("retryable_error");
    expect(record.lastError).toMatchObject({ stage: "slack", code: "service_unavailable", retryable: true });
    expect(record.expiresAt.toISOString()).toBe("2026-07-02T00:00:00.000Z");
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
    expect(repository.records.get("Ev2")?.selectedEmojis).toEqual(["eyes", "white_check_mark", "tada"]);
    expect(repository.records.get("Ev2")?.selectionSource).toBe("fallback_invalid_output");
  });

  it("uses deterministic fallback when Gemini throws", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };
    const selector = { select: vi.fn(() => Promise.reject(new Error("timeout"))) };
    await processSlackEvent({ ...base, payload: { ...payload, eventId: "EvGeminiError" }, repository, emojiSelector: selector, reactionClient });
    expect(repository.records.get("EvGeminiError")?.selectedEmojis).toEqual(["eyes", "white_check_mark", "tada"]);
    expect(repository.records.get("EvGeminiError")?.selectionSource).toBe("fallback_gemini_error");
  });

  it("includes available custom emoji in Gemini candidates", async () => {
    const repository = new MemoryProcessRepository();
    const customConfig: EmojiConfig = {
      candidates: [...emojiConfig.candidates, emoji("shipit", "custom"), emoji("missing_custom", "custom")],
      fallback: emojiConfig.fallback
    };
    let candidateNames: string[] = [];
    const selector = {
      select: vi.fn(({ candidates }: { candidates: EmojiCandidate[] }) => {
        candidateNames = candidates.map((candidate) => candidate.name);
        return Promise.resolve({ names: ["shipit", "eyes", "tada"] as [string, string, string], source: "gemini" as const });
      })
    };
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: true as const })) };

    await processSlackEvent({
      ...base,
      emojiConfig: customConfig,
      payload: { ...payload, eventId: "EvCustom" },
      repository,
      emojiCatalog: { listCustomEmojiNames: () => Promise.resolve(new Set(["shipit"])) },
      emojiSelector: selector,
      reactionClient
    });

    expect(selector.select).toHaveBeenCalledOnce();
    expect(candidateNames).toEqual([
      "eyes",
      "white_check_mark",
      "tada",
      "pray",
      "bulb",
      "rocket",
      "shipit"
    ]);
    expect(repository.records.get("EvCustom")?.selectedEmojis).toEqual(["shipit", "eyes", "tada"]);
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

  it("replaces invalid_name once with an unused standard fallback", async () => {
    const repository = new MemoryProcessRepository();
    const calls: string[] = [];
    const reactionClient = {
      addReaction: vi.fn(({ emojiName }: { emojiName: string }) => {
        calls.push(emojiName);
        return Promise.resolve(emojiName === "rocket" ? { ok: false as const, retryable: false, code: "invalid_name" as const } : { ok: true as const });
      })
    };

    await expect(
      processSlackEvent({
        ...base,
        payload: { ...payload, eventId: "Ev4" },
        repository,
        emojiSelector: { select: () => Promise.resolve({ names: ["rocket", "eyes", "white_check_mark"], source: "gemini" }) },
        reactionClient
      })
    ).resolves.toEqual({ kind: "completed" });

    expect(calls).toEqual(["rocket", "tada", "eyes", "white_check_mark"]);
    expect(repository.records.get("Ev4")?.selectedEmojis).toEqual(["tada", "eyes", "white_check_mark"]);
  });

  it("uses the first unused standard candidate when fallback names are unavailable", async () => {
    const repository = new MemoryProcessRepository();
    const calls: string[] = [];
    const reactionClient = {
      addReaction: vi.fn(({ emojiName }: { emojiName: string }) => {
        calls.push(emojiName);
        return Promise.resolve(emojiName === "eyes" ? { ok: false as const, retryable: false, code: "invalid_name" as const } : { ok: true as const });
      })
    };

    await processSlackEvent({
      ...base,
      payload: { ...payload, eventId: "EvFallbackCandidate" },
      repository,
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient
    });

    expect(calls).toEqual(["eyes", "pray", "white_check_mark", "tada"]);
    expect(repository.records.get("EvFallbackCandidate")?.selectedEmojis).toEqual(["pray", "white_check_mark", "tada"]);
  });

  it("marks permanent Slack errors and stops processing remaining reactions", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = {
      addReaction: vi.fn(({ emojiName }: { emojiName: string }) =>
        Promise.resolve(emojiName === "white_check_mark" ? { ok: false as const, retryable: false, code: "missing_scope" as const } : { ok: true as const })
      )
    };

    await expect(
      processSlackEvent({
        ...base,
        payload: { ...payload, eventId: "EvPermanent" },
        repository,
        emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
        reactionClient
      })
    ).resolves.toEqual({ kind: "completed" });

    expect(reactionClient.addReaction).toHaveBeenCalledTimes(2);
    expect(repository.records.get("EvPermanent")?.status).toBe("permanent_error");
    expect(repository.records.get("EvPermanent")?.lastError).toMatchObject({ stage: "slack", code: "missing_scope", retryable: false });
  });

  it("returns retry-after seconds for Slack rate limits", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = {
      addReaction: vi.fn(() => Promise.resolve({ ok: false as const, retryable: true, code: "ratelimited" as const, retryAfterSeconds: 42 }))
    };

    await expect(
      processSlackEvent({
        ...base,
        payload: { ...payload, eventId: "EvRateLimit" },
        repository,
        emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
        reactionClient
      })
    ).resolves.toEqual({ kind: "retryable", retryAfterSeconds: 42 });

    expect(repository.records.get("EvRateLimit")?.status).toBe("retryable_error");
    expect(repository.records.get("EvRateLimit")?.lastError).toMatchObject({ code: "ratelimited", retryable: true });
  });

  it("marks invalid_name permanent when no unused standard replacement is available", async () => {
    const repository = new MemoryProcessRepository();
    const reactionClient = { addReaction: vi.fn(() => Promise.resolve({ ok: false as const, retryable: false, code: "invalid_name" as const })) };
    const narrowConfig: EmojiConfig = {
      candidates: [emoji("eyes"), emoji("white_check_mark"), emoji("tada")],
      fallback: ["eyes", "white_check_mark", "tada"]
    };

    await processSlackEvent({
      ...base,
      emojiConfig: narrowConfig,
      payload: { ...payload, eventId: "EvInvalidName" },
      repository,
      emojiSelector: { select: () => Promise.resolve({ names: ["eyes", "white_check_mark", "tada"], source: "gemini" }) },
      reactionClient
    });

    expect(reactionClient.addReaction).toHaveBeenCalledTimes(1);
    expect(repository.records.get("EvInvalidName")?.status).toBe("permanent_error");
    expect(repository.records.get("EvInvalidName")?.selectedEmojis).toEqual(["eyes", "white_check_mark", "tada"]);
  });

  it("exposes standard-only fallback ports for production wiring defaults", async () => {
    const catalog = standardOnlyCatalog();
    const selector = fallbackSelector(emojiConfig);
    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set<string>());
    await expect(selector.select({ analysisText: "hello", candidates: emojiConfig.candidates })).resolves.toEqual({
      names: ["eyes", "white_check_mark", "tada"],
      source: "fallback_gemini_error"
    });
  });
});

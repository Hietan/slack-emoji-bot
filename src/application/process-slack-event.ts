import { randomUUID } from "node:crypto";
import type { EmojiCatalog } from "./ports/emoji-catalog.js";
import type { EmojiSelector } from "./ports/emoji-selector.js";
import type { ProcessRepository } from "./ports/process-repository.js";
import type { ReactionClient } from "./ports/reaction-client.js";
import type { EmojiCandidate, EmojiConfig, EmojiSelection } from "../domain/emoji.js";
import { selectFallback, validateSelection } from "../domain/emoji.js";
import type { WorkerOutcome } from "../domain/errors.js";
import type { TaskPayload } from "../domain/task-payload.js";
import type { Clock } from "../shared/clock.js";
import { eventIdHash } from "../shared/crypto.js";

export type ProcessObserverEvent =
  | {
      event: "worker_lease_acquired";
      eventIdHash: string;
      channelId: string;
      messageTs: string;
      attemptCount: number;
    }
  | { event: "worker_already_completed"; eventIdHash: string; status: "already_completed" }
  | { event: "custom_emoji_catalog_loaded"; eventIdHash: string; count: number }
  | { event: "custom_emoji_catalog_unavailable"; eventIdHash: string; code: "missing_scope" | "unavailable" }
  | { event: "custom_emoji_candidates_missing"; eventIdHash: string; emojiNames: string[] }
  | { event: "gemini_selection_succeeded"; eventIdHash: string; source: "gemini" }
  | {
      event: "gemini_selection_fallback";
      eventIdHash: string;
      source: "fallback_gemini_error" | "fallback_invalid_output" | "fallback_no_custom_catalog";
    }
  | { event: "slack_reaction_succeeded"; eventIdHash: string; emojiName: string; alreadyPresent: boolean }
  | { event: "slack_reaction_retryable_error"; eventIdHash: string; code: string; retryAfterSeconds?: number }
  | { event: "slack_reaction_permanent_error"; eventIdHash: string; code: string }
  | { event: "worker_completed"; eventIdHash: string; status: "completed" | "already_completed" | "invalid_task" };

export type ProcessObserver = (event: ProcessObserverEvent) => void;

export type ProcessSlackEventConfig = {
  teamId: string;
  apiAppId: string;
  targetChannelIds: ReadonlySet<string>;
  targetUserIds: ReadonlySet<string>;
  dryRun: boolean;
  leaseSeconds: number;
};

export async function processSlackEvent(input: {
  payload: TaskPayload;
  config: ProcessSlackEventConfig;
  emojiConfig: EmojiConfig;
  repository: ProcessRepository;
  emojiCatalog: EmojiCatalog;
  emojiSelector: EmojiSelector;
  reactionClient: ReactionClient;
  clock: Clock;
  observer?: ProcessObserver;
}): Promise<WorkerOutcome> {
  const { payload, config } = input;
  const hashedEventId = eventIdHash(payload.eventId);
  if (
    payload.teamId !== config.teamId ||
    payload.apiAppId !== config.apiAppId ||
    !config.targetChannelIds.has(payload.channelId) ||
    !config.targetUserIds.has(payload.userId)
  ) {
    input.observer?.({ event: "worker_completed", eventIdHash: hashedEventId, status: "invalid_task" });
    return { kind: "invalid_task" };
  }

  const now = input.clock.now();
  const lease = await input.repository.acquireLease(
    payload,
    randomUUID(),
    new Date(now.getTime() + config.leaseSeconds * 1000),
    now
  );
  if (lease.kind === "already_completed") {
    input.observer?.({ event: "worker_already_completed", eventIdHash: hashedEventId, status: "already_completed" });
    return { kind: "already_completed" };
  }
  if (lease.kind === "conflict") {
    return { kind: "lease_conflict" };
  }

  let record = lease.record;
  input.observer?.({
    event: "worker_lease_acquired",
    eventIdHash: hashedEventId,
    channelId: payload.channelId,
    messageTs: payload.messageTs,
    attemptCount: record.attemptCount
  });
  if (record.selectedEmojis === null) {
    const selection = await selectEmoji({
      eventIdHash: hashedEventId,
      analysisText: payload.analysisText,
      emojiConfig: input.emojiConfig,
      emojiCatalog: input.emojiCatalog,
      emojiSelector: input.emojiSelector,
      ...(input.observer === undefined ? {} : { observer: input.observer })
    });
    record = await input.repository.persistSelection(payload.eventId, selection, input.clock.now());
  }

  if (config.dryRun) {
    await input.repository.markCompleted(payload.eventId, true, input.clock.now());
    input.observer?.({ event: "worker_completed", eventIdHash: hashedEventId, status: "completed" });
    return { kind: "completed" };
  }

  const selectedEmojiNames = record.selectedEmojis;
  if (selectedEmojiNames === null) {
    await input.repository.markPermanentError(payload.eventId, "selection_missing", input.clock.now());
    input.observer?.({ event: "slack_reaction_permanent_error", eventIdHash: hashedEventId, code: "selection_missing" });
    return { kind: "completed" };
  }

  let currentSelection = selectedEmojiNames;
  const replacedInvalidNames = new Set<string>();
  for (let index = 0; index < currentSelection.length; index += 1) {
    const emojiName = currentSelection[index];
    if (emojiName === undefined) {
      continue;
    }
    if (record.completedEmojis.includes(emojiName)) {
      continue;
    }
    let result = await input.reactionClient.addReaction({
      channelId: payload.channelId,
      messageTs: payload.messageTs,
      emojiName
    });
    if (!result.ok && result.code === "invalid_name" && !replacedInvalidNames.has(emojiName)) {
      const replacement = findFallbackReplacement(input.emojiConfig, currentSelection, record.completedEmojis);
      if (replacement !== null) {
        replacedInvalidNames.add(emojiName);
        currentSelection = replaceAt(currentSelection, index, replacement);
        record = await input.repository.persistSelection(
          payload.eventId,
          { names: currentSelection, source: record.selectionSource ?? "fallback_invalid_output" },
          input.clock.now()
        );
        const retryResult = await input.reactionClient.addReaction({
          channelId: payload.channelId,
          messageTs: payload.messageTs,
          emojiName: replacement
        });
        if (retryResult.ok) {
          record = await input.repository.markReactionComplete(payload.eventId, replacement, input.clock.now());
          input.observer?.({
            event: "slack_reaction_succeeded",
            eventIdHash: hashedEventId,
            emojiName: replacement,
            alreadyPresent: retryResult.alreadyPresent === true
          });
          continue;
        }
        result = retryResult;
      }
    }
    if (!result.ok) {
      if (result.retryable) {
        await input.repository.markRetryableError(payload.eventId, result.code, input.clock.now());
        const retryableEvent: ProcessObserverEvent = {
          event: "slack_reaction_retryable_error",
          eventIdHash: hashedEventId,
          code: result.code
        };
        input.observer?.(
          result.retryAfterSeconds === undefined
            ? retryableEvent
            : { ...retryableEvent, retryAfterSeconds: result.retryAfterSeconds }
        );
        return result.retryAfterSeconds === undefined
          ? { kind: "retryable" }
          : { kind: "retryable", retryAfterSeconds: result.retryAfterSeconds };
      }
      await input.repository.markPermanentError(payload.eventId, result.code, input.clock.now());
      input.observer?.({ event: "slack_reaction_permanent_error", eventIdHash: hashedEventId, code: result.code });
      return { kind: "completed" };
    }
    record = await input.repository.markReactionComplete(payload.eventId, emojiName, input.clock.now());
    input.observer?.({
      event: "slack_reaction_succeeded",
      eventIdHash: hashedEventId,
      emojiName,
      alreadyPresent: result.alreadyPresent === true
    });
  }

  await input.repository.markCompleted(payload.eventId, false, input.clock.now());
  input.observer?.({ event: "worker_completed", eventIdHash: hashedEventId, status: "completed" });
  return { kind: "completed" };
}

function replaceAt(names: [string, string, string], index: number, replacement: string): [string, string, string] {
  const updated: [string, string, string] = [...names];
  updated[index] = replacement;
  return updated;
}

function findFallbackReplacement(
  emojiConfig: EmojiConfig,
  selectedNames: readonly string[],
  completedNames: readonly string[]
): string | null {
  const unavailable = new Set([...selectedNames, ...completedNames]);
  for (const name of emojiConfig.fallback) {
    const candidate = emojiConfig.candidates.find((item) => item.name === name);
    if (candidate !== undefined && !unavailable.has(name)) {
      return name;
    }
  }
  for (const candidate of emojiConfig.candidates) {
    if (!unavailable.has(candidate.name)) {
      return candidate.name;
    }
  }
  return null;
}

async function selectEmoji(input: {
  eventIdHash: string;
  analysisText: string;
  emojiConfig: EmojiConfig;
  emojiCatalog: EmojiCatalog;
  emojiSelector: EmojiSelector;
  observer?: ProcessObserver;
}): Promise<EmojiSelection> {
  const customCandidates = input.emojiConfig.candidates.filter((candidate) => candidate.kind === "custom");
  let customNames: ReadonlySet<string> = new Set<string>();
  if (customCandidates.length > 0) {
    try {
      customNames = await input.emojiCatalog.listCustomEmojiNames();
      input.observer?.({ event: "custom_emoji_catalog_loaded", eventIdHash: input.eventIdHash, count: customNames.size });
      const missingNames = customCandidates.map((candidate) => candidate.name).filter((name) => !customNames.has(name));
      if (missingNames.length > 0) {
        input.observer?.({ event: "custom_emoji_candidates_missing", eventIdHash: input.eventIdHash, emojiNames: missingNames });
      }
    } catch (error: unknown) {
      input.observer?.({
        event: "custom_emoji_catalog_unavailable",
        eventIdHash: input.eventIdHash,
        code: isMissingScopeError(error) ? "missing_scope" : "unavailable"
      });
    }
  }
  const candidates = input.emojiConfig.candidates.filter(
    (candidate) => candidate.kind === "standard" || customNames.has(candidate.name)
  );
  const allowlist = new Set(candidates.map((candidate) => candidate.name));
  try {
    const selection = await input.emojiSelector.select({ analysisText: input.analysisText, candidates });
    const valid = validateSelection(selection.names, allowlist);
    if (valid !== null) {
      input.observer?.({ event: "gemini_selection_succeeded", eventIdHash: input.eventIdHash, source: "gemini" });
      return { names: valid, source: "gemini" };
    }
  } catch {
    const fallback = selectFallback(input.emojiConfig, allowlist);
    input.observer?.({ event: "gemini_selection_fallback", eventIdHash: input.eventIdHash, source: "fallback_gemini_error" });
    return fallback;
  }
  const fallback = selectFallback(input.emojiConfig, allowlist);
  input.observer?.({ event: "gemini_selection_fallback", eventIdHash: input.eventIdHash, source: "fallback_invalid_output" });
  return { ...fallback, source: "fallback_invalid_output" };
}

export function standardOnlyCatalog(): EmojiCatalog {
  return {
    listCustomEmojiNames: () => Promise.resolve(new Set<string>())
  };
}

export function fallbackSelector(emojiConfig: EmojiConfig): EmojiSelector {
  return {
    select: (request: { candidates: EmojiCandidate[] }) =>
      Promise.resolve({ ...selectFallback(emojiConfig, new Set(request.candidates.map((candidate) => candidate.name))), source: "fallback_gemini_error" })
  };
}

function isMissingScopeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return false;
  }
  const data = error.data as { error?: unknown };
  return data.error === "missing_scope";
}

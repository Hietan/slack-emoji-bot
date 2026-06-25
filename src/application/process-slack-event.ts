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

export type ProcessSlackEventConfig = {
  teamId: string;
  apiAppId: string;
  targetChannelIds: ReadonlySet<string>;
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
}): Promise<WorkerOutcome> {
  const { payload, config } = input;
  if (
    payload.teamId !== config.teamId ||
    payload.apiAppId !== config.apiAppId ||
    !config.targetChannelIds.has(payload.channelId)
  ) {
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
    return { kind: "already_completed" };
  }
  if (lease.kind === "conflict") {
    return { kind: "lease_conflict" };
  }

  let record = lease.record;
  if (record.selectedEmojiNames === null) {
    const selection = await selectEmoji({
      analysisText: payload.analysisText,
      emojiConfig: input.emojiConfig,
      emojiCatalog: input.emojiCatalog,
      emojiSelector: input.emojiSelector
    });
    record = await input.repository.persistSelection(payload.eventId, selection, input.clock.now());
  }

  if (config.dryRun) {
    await input.repository.markCompleted(payload.eventId, true, input.clock.now());
    return { kind: "completed" };
  }

  const selectedEmojiNames = record.selectedEmojiNames;
  if (selectedEmojiNames === null) {
    await input.repository.markPermanentError(payload.eventId, "selection_missing", input.clock.now());
    return { kind: "completed" };
  }

  for (const emojiName of selectedEmojiNames) {
    if (record.completedEmojiNames.includes(emojiName)) {
      continue;
    }
    const result = await input.reactionClient.addReaction({
      channelId: payload.channelId,
      messageTs: payload.messageTs,
      emojiName
    });
    if (!result.ok) {
      if (result.retryable) {
        return result.retryAfterSeconds === undefined
          ? { kind: "retryable" }
          : { kind: "retryable", retryAfterSeconds: result.retryAfterSeconds };
      }
      await input.repository.markPermanentError(payload.eventId, result.code, input.clock.now());
      return { kind: "completed" };
    }
    record = await input.repository.markReactionComplete(payload.eventId, emojiName, input.clock.now());
  }

  await input.repository.markCompleted(payload.eventId, false, input.clock.now());
  return { kind: "completed" };
}

async function selectEmoji(input: {
  analysisText: string;
  emojiConfig: EmojiConfig;
  emojiCatalog: EmojiCatalog;
  emojiSelector: EmojiSelector;
}): Promise<EmojiSelection> {
  const customNames = await input.emojiCatalog.listCustomEmojiNames().catch(() => new Set<string>());
  const candidates = input.emojiConfig.candidates.filter(
    (candidate) => candidate.kind === "standard" || customNames.has(candidate.name)
  );
  const allowlist = new Set(candidates.map((candidate) => candidate.name));
  try {
    const selection = await input.emojiSelector.select({ analysisText: input.analysisText, candidates });
    const valid = validateSelection(selection.names, allowlist);
    if (valid !== null) {
      return { names: valid, source: "gemini" };
    }
  } catch {
    return selectFallback(input.emojiConfig, allowlist);
  }
  return selectFallback(input.emojiConfig, allowlist);
}

export function standardOnlyCatalog(): EmojiCatalog {
  return {
    listCustomEmojiNames: () => Promise.resolve(new Set<string>())
  };
}

export function fallbackSelector(emojiConfig: EmojiConfig): EmojiSelector {
  return {
    select: (request: { candidates: EmojiCandidate[] }) =>
      Promise.resolve(selectFallback(emojiConfig, new Set(request.candidates.map((candidate) => candidate.name))))
  };
}

import type { TaskQueue } from "./ports/task-queue.js";
import { decideSlackEvent } from "../domain/slack-event.js";
import type { IgnoredReason } from "../domain/errors.js";
import type { Clock } from "../shared/clock.js";
import { normalizeAnalysisText } from "../shared/text-normalizer.js";

export type ReceiveSlackEventResult =
  | { ok: true; accepted: true; duplicateTask: boolean }
  | { ok: true; accepted: false; reason: IgnoredReason };

export type ReceiveSlackEventConfig = {
  teamId: string;
  apiAppId: string;
  targetChannelIds: ReadonlySet<string>;
  targetUserIds: ReadonlySet<string>;
  maxAnalysisTextChars: number;
};

export async function receiveSlackEvent(input: {
  envelope: unknown;
  rawText: string;
  config: ReceiveSlackEventConfig;
  taskQueue: TaskQueue;
  clock: Clock;
}): Promise<ReceiveSlackEventResult> {
  const normalized = normalizeAnalysisText(input.rawText, input.config.maxAnalysisTextChars);
  const decision = decideSlackEvent(input.envelope, normalized, {
    teamId: input.config.teamId,
    apiAppId: input.config.apiAppId,
    targetChannelIds: input.config.targetChannelIds,
    targetUserIds: input.config.targetUserIds
  });
  if (!decision.accepted) {
    return { ok: true, accepted: false, reason: decision.reason };
  }
  const enqueueResult = await input.taskQueue.enqueue({
    schemaVersion: 1,
    ...decision.event,
    receivedAt: input.clock.now().toISOString()
  });
  return { ok: true, accepted: true, duplicateTask: enqueueResult === "already_exists" };
}

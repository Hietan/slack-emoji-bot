import { Router } from "express";
import { processSlackEvent } from "../../application/process-slack-event.js";
import type { EmojiCatalog } from "../../application/ports/emoji-catalog.js";
import type { EmojiSelector } from "../../application/ports/emoji-selector.js";
import type { ProcessRepository } from "../../application/ports/process-repository.js";
import type { ReactionClient } from "../../application/ports/reaction-client.js";
import type { WorkerEnv } from "../../config/worker-env.js";
import type { EmojiConfig } from "../../domain/emoji.js";
import { taskPayloadSchema } from "../../domain/task-payload.js";
import type { Clock } from "../../shared/clock.js";
import { createLogger } from "../../shared/logger.js";

export function createProcessTaskRouter(input: {
  env: WorkerEnv;
  emojiConfig: EmojiConfig;
  repository: ProcessRepository;
  emojiCatalog: EmojiCatalog;
  emojiSelector: EmojiSelector;
  reactionClient: ReactionClient;
  clock: Clock;
}) {
  const router = Router();
  const logger = createLogger("worker");

  router.post("/", async (request, response) => {
    const payload = taskPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      logger.warn({ event: "worker_retry_scheduled", reason: "invalid_task_schema" }, "invalid task discarded");
      response.status(204).send();
      return;
    }
    const outcome = await processSlackEvent({
      payload: payload.data,
      config: {
        teamId: input.env.SLACK_TEAM_ID,
        apiAppId: input.env.SLACK_APP_ID,
        targetChannelIds: input.env.targetChannelSet,
        dryRun: input.env.DRY_RUN,
        leaseSeconds: input.env.LEASE_SECONDS
      },
      emojiConfig: input.emojiConfig,
      repository: input.repository,
      emojiCatalog: input.emojiCatalog,
      emojiSelector: input.emojiSelector,
      reactionClient: input.reactionClient,
      clock: input.clock,
      observer: (event) => {
        logger.info(event, event.event);
      }
    });
    if (outcome.kind === "lease_conflict") {
      response.status(409).send();
      return;
    }
    if (outcome.kind === "retryable") {
      if (outcome.retryAfterSeconds !== undefined) {
        response.setHeader("Retry-After", String(outcome.retryAfterSeconds));
        response.status(429).send();
        return;
      }
      response.status(503).send();
      return;
    }
    response.status(204).send();
  });

  return router;
}

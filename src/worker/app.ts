import express from "express";
import type { EmojiCatalog } from "../application/ports/emoji-catalog.js";
import type { EmojiSelector } from "../application/ports/emoji-selector.js";
import type { ProcessRepository } from "../application/ports/process-repository.js";
import type { ReactionClient } from "../application/ports/reaction-client.js";
import type { WorkerEnv } from "../config/worker-env.js";
import type { EmojiConfig } from "../domain/emoji.js";
import type { Clock } from "../shared/clock.js";
import { systemClock } from "../shared/clock.js";
import { createProcessTaskRouter } from "./routes/process-task.js";

export function createWorkerApp(input: {
  env: WorkerEnv;
  emojiConfig: EmojiConfig;
  repository: ProcessRepository;
  emojiCatalog: EmojiCatalog;
  emojiSelector: EmojiSelector;
  reactionClient: ReactionClient;
  clock?: Clock;
}) {
  const app = express();
  const clock = input.clock ?? systemClock;
  const healthHandler = (_request: express.Request, response: express.Response) => {
    response.status(200).json({ ok: true, service: "worker" });
  };
  app.get("/healthz", healthHandler);
  app.get("/livez", healthHandler);
  app.use(express.json({ limit: "64kb" }));
  app.use(
    "/tasks/process",
    createProcessTaskRouter({
      env: input.env,
      emojiConfig: input.emojiConfig,
      repository: input.repository,
      emojiCatalog: input.emojiCatalog,
      emojiSelector: input.emojiSelector,
      reactionClient: input.reactionClient,
      clock
    })
  );
  return app;
}

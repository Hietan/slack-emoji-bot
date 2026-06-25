import { Firestore } from "@google-cloud/firestore";
import { FirestoreProcessRepository } from "../adapters/firestore-process-repository.js";
import { GeminiEmojiSelector } from "../adapters/gemini-emoji-selector.js";
import { SlackEmojiCatalog } from "../adapters/slack-emoji-catalog.js";
import { SlackReactionClient } from "../adapters/slack-reaction-client.js";
import { loadEmojiConfig } from "../config/emoji-config.js";
import { loadWorkerEnv } from "../config/worker-env.js";
import { createLogger } from "../shared/logger.js";
import { createWorkerApp } from "./app.js";

const logger = createLogger("worker");
const env = loadWorkerEnv();
const emojiConfig = loadEmojiConfig(env.EMOJI_CONFIG_PATH);
const app = createWorkerApp({
  env,
  emojiConfig,
  repository: new FirestoreProcessRepository(new Firestore({ databaseId: env.FIRESTORE_DATABASE_ID }), env.PROCESS_RECORD_TTL_DAYS),
  emojiCatalog: new SlackEmojiCatalog(env.SLACK_BOT_TOKEN, undefined, env.CUSTOM_EMOJI_CACHE_TTL_SECONDS),
  emojiSelector: new GeminiEmojiSelector({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS }),
  reactionClient: new SlackReactionClient(env.SLACK_BOT_TOKEN, undefined, env.SLACK_TIMEOUT_MS)
});

app.listen(env.PORT, () => {
  logger.info({ event: "service_started", port: env.PORT }, "worker started");
});

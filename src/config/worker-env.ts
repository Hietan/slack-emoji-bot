import { z } from "zod";
import { configError, zodConfigIssues } from "./env-errors.js";
import { parseTargetChannelSet } from "./target-channels.js";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),
  TARGET_CHANNEL_IDS: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  SLACK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(5000),
  GEMINI_UNPAID_TERMS_ACKNOWLEDGED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EMOJI_CONFIG_PATH: z.string().min(1).default("/app/config/emoji.default.yaml"),
  CUSTOM_EMOJI_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  FIRESTORE_DATABASE_ID: z.string().min(1).default("(default)"),
  PROCESS_RECORD_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  DRY_RUN: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type WorkerEnv = z.infer<typeof workerEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
};

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw configError("Invalid worker environment", zodConfigIssues(parsed.error));
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.GEMINI_UNPAID_TERMS_ACKNOWLEDGED) {
    throw configError("Invalid worker environment", ["GEMINI_UNPAID_TERMS_ACKNOWLEDGED: must be true in production"]);
  }
  try {
    const targetChannelSet = parseTargetChannelSet(parsed.data.TARGET_CHANNEL_IDS);
    return { ...parsed.data, targetChannelSet };
  } catch (error) {
    throw configError("Invalid worker environment", [`TARGET_CHANNEL_IDS: ${error instanceof Error ? error.message : "invalid value"}`]);
  }
}

import { z } from "zod";
import { parseTargetChannelSet } from "./target-channels.js";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(8080),
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
    .transform((value) => value === "true"),
  LEASE_SECONDS: z.coerce.number().int().positive().default(120)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
};

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = workerEnvSchema.parse(source);
  if (parsed.NODE_ENV === "production" && !parsed.GEMINI_UNPAID_TERMS_ACKNOWLEDGED) {
    throw new Error("GEMINI_UNPAID_TERMS_ACKNOWLEDGED must be true in production");
  }
  const targetChannelSet = parseTargetChannelSet(parsed.TARGET_CHANNEL_IDS);
  return { ...parsed, targetChannelSet };
}

import { z } from "zod";
import { configError, zodConfigIssues } from "./env-errors.js";
import { parseTargetChannelSet, parseTargetUserSet } from "./target-channels.js";

const receiverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),
  TARGET_CHANNEL_IDS: z.string().min(1),
  TARGET_USER_IDS: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  GCP_REGION: z.string().min(1).default("asia-northeast1"),
  CLOUD_TASKS_QUEUE_ID: z.string().min(1).default("emoji-reaction-jobs"),
  WORKER_URL: z.string().url(),
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  MAX_ANALYSIS_TEXT_CHARS: z.coerce.number().int().min(100).max(10000).default(2000)
});

export type ReceiverEnv = z.infer<typeof receiverEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
  targetUserSet: ReadonlySet<string>;
};

export function loadReceiverEnv(source: NodeJS.ProcessEnv = process.env): ReceiverEnv {
  const parsed = receiverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw configError("Invalid receiver environment", zodConfigIssues(parsed.error));
  }
  try {
    const targetChannelSet = parseTargetChannelSet(parsed.data.TARGET_CHANNEL_IDS);
    const targetUserSet = parseTargetUserSet(parsed.data.TARGET_USER_IDS);
    return { ...parsed.data, targetChannelSet, targetUserSet };
  } catch (error) {
    throw configError("Invalid receiver environment", [error instanceof Error ? error.message : "invalid target ID list"]);
  }
}

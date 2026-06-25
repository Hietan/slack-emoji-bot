import { z } from "zod";
import { parseTargetChannelSet } from "./target-channels.js";

const receiverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(8080),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),
  TARGET_CHANNEL_IDS: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  GCP_REGION: z.string().min(1).default("asia-northeast1"),
  CLOUD_TASKS_QUEUE_ID: z.string().min(1).default("emoji-reaction-jobs"),
  WORKER_URL: z.string().url(),
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  MAX_ANALYSIS_TEXT_CHARS: z.coerce.number().int().min(100).max(10000).default(2000)
});

export type ReceiverEnv = z.infer<typeof receiverEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
};

export function loadReceiverEnv(source: NodeJS.ProcessEnv = process.env): ReceiverEnv {
  const parsed = receiverEnvSchema.parse(source);
  const targetChannelSet = parseTargetChannelSet(parsed.TARGET_CHANNEL_IDS);
  return { ...parsed, targetChannelSet };
}

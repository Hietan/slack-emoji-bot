import { z } from "zod";

const receiverEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),
  TARGET_CHANNEL_IDS: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  GCP_LOCATION: z.string().min(1).default("asia-northeast1"),
  CLOUD_TASKS_QUEUE_ID: z.string().min(1).default("emoji-reaction-jobs"),
  WORKER_URL: z.string().url(),
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  MAX_ANALYSIS_TEXT_CHARS: z.coerce.number().int().positive().max(2000).default(2000)
});

export type ReceiverEnv = z.infer<typeof receiverEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
};

export function loadReceiverEnv(source: NodeJS.ProcessEnv = process.env): ReceiverEnv {
  const parsed = receiverEnvSchema.parse(source);
  const targetChannelSet = new Set(parsed.TARGET_CHANNEL_IDS.split(",").map((value) => value.trim()).filter(Boolean));
  if (targetChannelSet.size === 0) {
    throw new Error("TARGET_CHANNEL_IDS must contain at least one channel ID");
  }
  return { ...parsed, targetChannelSet };
}

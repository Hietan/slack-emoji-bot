import { z } from "zod";

const workerEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),
  TARGET_CHANNEL_IDS: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
  DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  LEASE_SECONDS: z.coerce.number().int().positive().default(120)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema> & {
  targetChannelSet: ReadonlySet<string>;
};

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = workerEnvSchema.parse(source);
  const targetChannelSet = new Set(parsed.TARGET_CHANNEL_IDS.split(",").map((value) => value.trim()).filter(Boolean));
  if (targetChannelSet.size === 0) {
    throw new Error("TARGET_CHANNEL_IDS must contain at least one channel ID");
  }
  return { ...parsed, targetChannelSet };
}

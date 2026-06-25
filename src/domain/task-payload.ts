import { z } from "zod";

export const taskPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  teamId: z.string().min(1),
  apiAppId: z.string().min(1),
  eventTime: z.number().int(),
  channelId: z.string().min(1),
  messageTs: z.string().regex(/^\d{10}\.\d{6}$/u),
  analysisText: z.string().min(1).max(2000),
  textSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  receivedAt: z.string().datetime()
});

export type TaskPayload = z.infer<typeof taskPayloadSchema>;

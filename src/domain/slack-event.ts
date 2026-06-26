import { z } from "zod";
import type { IgnoredReason } from "./errors.js";
import type { NormalizedText } from "../shared/text-normalizer.js";

const slackTimestampSchema = z.string().regex(/^\d{10}\.\d{6}$/u);

export const slackEnvelopeSchema = z
  .object({
    type: z.string(),
    team_id: z.string().optional(),
    api_app_id: z.string().optional(),
    event_id: z.string().optional(),
    event_time: z.number().int().optional(),
    challenge: z.string().optional(),
    event: z.unknown().optional()
  })
  .passthrough();

export const slackMessageEventSchema = z
  .object({
    type: z.string(),
    channel_type: z.string().optional(),
    channel: z.string().optional(),
    subtype: z.string().optional(),
    thread_ts: z.string().optional(),
    bot_id: z.string().optional(),
    app_id: z.string().optional(),
    hidden: z.boolean().optional(),
    user: z.string().optional(),
    ts: z.string().optional(),
    text: z.string().optional()
  })
  .passthrough();

export type AcceptedSlackEvent = {
  eventId: string;
  teamId: string;
  apiAppId: string;
  eventTime: number;
  channelId: string;
  userId: string;
  messageTs: string;
  analysisText: string;
  textSha256: string;
};

export type SlackEventDecision =
  | { accepted: true; event: AcceptedSlackEvent }
  | { accepted: false; reason: IgnoredReason };

export type SlackEventConfig = {
  teamId: string;
  apiAppId: string;
  targetChannelIds: ReadonlySet<string>;
  targetUserIds: ReadonlySet<string>;
};

export function decideSlackEvent(input: unknown, normalizedText: NormalizedText, config: SlackEventConfig): SlackEventDecision {
  const envelope = slackEnvelopeSchema.safeParse(input);
  if (!envelope.success || envelope.data.type !== "event_callback") {
    return { accepted: false, reason: "unsupported_envelope" };
  }
  if (envelope.data.team_id !== config.teamId || envelope.data.api_app_id !== config.apiAppId) {
    return { accepted: false, reason: "unsupported_envelope" };
  }
  const event = slackMessageEventSchema.safeParse(envelope.data.event);
  if (!event.success || event.data.type !== "message") {
    return { accepted: false, reason: "unsupported_event_type" };
  }
  if (event.data.channel_type !== "channel") {
    return { accepted: false, reason: "unsupported_channel_type" };
  }
  if (event.data.channel === undefined || !config.targetChannelIds.has(event.data.channel)) {
    return { accepted: false, reason: "channel_not_configured" };
  }
  if (event.data.subtype !== undefined) {
    return { accepted: false, reason: "message_subtype" };
  }
  if (event.data.thread_ts !== undefined) {
    return { accepted: false, reason: "thread_reply" };
  }
  if (event.data.bot_id !== undefined || event.data.app_id !== undefined) {
    return { accepted: false, reason: "bot_message" };
  }
  if (event.data.hidden === true) {
    return { accepted: false, reason: "hidden_message" };
  }
  if (event.data.user === undefined || event.data.user.length === 0) {
    return { accepted: false, reason: "missing_user" };
  }
  if (!config.targetUserIds.has(event.data.user)) {
    return { accepted: false, reason: "user_not_configured" };
  }
  const ts = slackTimestampSchema.safeParse(event.data.ts);
  if (!ts.success) {
    return { accepted: false, reason: "invalid_timestamp" };
  }
  if (normalizedText.analysisText.length === 0) {
    return { accepted: false, reason: "empty_text" };
  }
  if (envelope.data.event_id === undefined || envelope.data.event_time === undefined) {
    return { accepted: false, reason: "unsupported_envelope" };
  }
  return {
    accepted: true,
    event: {
      eventId: envelope.data.event_id,
      teamId: envelope.data.team_id,
      apiAppId: envelope.data.api_app_id,
      eventTime: envelope.data.event_time,
      channelId: event.data.channel,
      userId: event.data.user,
      messageTs: ts.data,
      analysisText: normalizedText.analysisText,
      textSha256: normalizedText.textSha256
    }
  };
}

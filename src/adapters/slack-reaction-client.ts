import { WebClient } from "@slack/web-api";
import type { ReactionClient } from "../application/ports/reaction-client.js";
import type { ReactionResult, SlackReactionErrorCode } from "../domain/errors.js";

export class SlackReactionClient implements ReactionClient {
  readonly #client: WebClient;

  public constructor(token: string, client = new WebClient(token)) {
    this.#client = client;
  }

  public async addReaction(input: { channelId: string; messageTs: string; emojiName: string }): Promise<ReactionResult> {
    try {
      await this.#client.reactions.add({
        channel: input.channelId,
        timestamp: input.messageTs,
        name: input.emojiName
      });
      return { ok: true };
    } catch (error: unknown) {
      return classifySlackReactionError(error);
    }
  }
}

export function classifySlackReactionError(error: unknown): ReactionResult {
  const code = extractSlackErrorCode(error);
  if (code === "already_reacted") {
    return { ok: true, alreadyPresent: true };
  }
  if (code === "ratelimited" || code === "service_unavailable") {
    const retryAfterSeconds = extractRetryAfter(error);
    return retryAfterSeconds === undefined
      ? { ok: false, retryable: true, code }
      : { ok: false, retryable: true, code, retryAfterSeconds };
  }
  const permanentCodes = new Set<SlackReactionErrorCode>([
    "too_many_emoji",
    "no_reaction",
    "not_in_channel",
    "channel_not_found",
    "message_not_found",
    "invalid_name"
  ]);
  if (permanentCodes.has(code)) {
    return { ok: false, retryable: false, code };
  }
  return { ok: false, retryable: true, code: "unknown_error" };
}

function extractSlackErrorCode(error: unknown): SlackReactionErrorCode {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data as { error?: unknown };
    if (typeof data.error === "string" && isSlackReactionErrorCode(data.error)) {
      return data.error;
    }
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "slack_webapi_rate_limited_error") {
    return "ratelimited";
  }
  return "unknown_error";
}

function extractRetryAfter(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "retryAfter" in error && typeof error.retryAfter === "number") {
    return error.retryAfter;
  }
  return undefined;
}

function isSlackReactionErrorCode(value: string): value is SlackReactionErrorCode {
  return [
    "already_reacted",
    "too_many_emoji",
    "no_reaction",
    "not_in_channel",
    "channel_not_found",
    "message_not_found",
    "invalid_name",
    "ratelimited",
    "service_unavailable",
    "unknown_error"
  ].includes(value);
}

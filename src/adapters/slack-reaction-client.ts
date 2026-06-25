import { WebClient } from "@slack/web-api";
import type { ReactionClient } from "../application/ports/reaction-client.js";
import type { ReactionResult, SlackReactionErrorCode } from "../domain/errors.js";

export class SlackReactionClient implements ReactionClient {
  readonly #client: WebClient;

  public constructor(token: string, client?: WebClient, timeoutMs = 5000) {
    this.#client = client ?? new WebClient(token, { timeout: timeoutMs });
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
  if (retryableCodes.has(code)) {
    const retryAfterSeconds = extractRetryAfter(error);
    return retryAfterSeconds === undefined
      ? { ok: false, retryable: true, code }
      : { ok: false, retryable: true, code, retryAfterSeconds };
  }
  if (permanentCodes.has(code)) {
    return { ok: false, retryable: false, code };
  }
  return { ok: false, retryable: true, code: "unknown_error" };
}

const retryableCodes = new Set<SlackReactionErrorCode>([
  "ratelimited",
  "internal_error",
  "fatal_error",
  "service_unavailable",
  "request_timeout",
  "external_channel_migrating",
  "team_added_to_org"
]);

const permanentCodes = new Set<SlackReactionErrorCode>([
  "invalid_auth",
  "token_expired",
  "token_revoked",
  "missing_scope",
  "no_permission",
  "channel_not_found",
  "message_not_found",
  "bad_timestamp",
  "is_archived",
  "thread_locked",
  "not_reactable",
  "too_many_emoji",
  "too_many_reactions",
  "team_access_not_granted",
  "invalid_name"
]);

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
    "too_many_reactions",
    "invalid_auth",
    "token_expired",
    "token_revoked",
    "missing_scope",
    "no_permission",
    "channel_not_found",
    "message_not_found",
    "bad_timestamp",
    "is_archived",
    "thread_locked",
    "not_reactable",
    "team_access_not_granted",
    "invalid_name",
    "ratelimited",
    "internal_error",
    "fatal_error",
    "service_unavailable",
    "request_timeout",
    "external_channel_migrating",
    "team_added_to_org",
    "unknown_error"
  ].includes(value);
}

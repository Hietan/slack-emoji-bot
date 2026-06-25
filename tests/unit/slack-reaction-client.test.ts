import { describe, expect, it } from "vitest";
import type { SlackReactionErrorCode } from "../../src/domain/errors.js";
import { classifySlackReactionError } from "../../src/adapters/slack-reaction-client.js";

describe("classifySlackReactionError", () => {
  it("treats already_reacted as success", () => {
    expect(classifySlackReactionError({ data: { error: "already_reacted" } })).toEqual({ ok: true, alreadyPresent: true });
  });

  it.each<SlackReactionErrorCode>([
    "ratelimited",
    "internal_error",
    "fatal_error",
    "service_unavailable",
    "request_timeout",
    "external_channel_migrating",
    "team_added_to_org"
  ])("classifies %s as retryable", (code) => {
    expect(classifySlackReactionError({ data: { error: code } })).toMatchObject({ ok: false, retryable: true, code });
  });

  it.each<SlackReactionErrorCode>([
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
  ])("classifies %s as permanent", (code) => {
    expect(classifySlackReactionError({ data: { error: code } })).toMatchObject({ ok: false, retryable: false, code });
  });

  it("extracts retry-after from Slack rate limit errors", () => {
    expect(classifySlackReactionError({ code: "slack_webapi_rate_limited_error", retryAfter: 30 })).toEqual({
      ok: false,
      retryable: true,
      code: "ratelimited",
      retryAfterSeconds: 30
    });
  });

  it("treats unknown errors as retryable without leaking raw errors", () => {
    expect(classifySlackReactionError({ data: { error: "surprising_error" }, responseBody: "secret" })).toEqual({
      ok: false,
      retryable: true,
      code: "unknown_error"
    });
  });
});

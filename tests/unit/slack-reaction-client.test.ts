import { describe, expect, it } from "vitest";
import { classifySlackReactionError } from "../../src/adapters/slack-reaction-client.js";

describe("classifySlackReactionError", () => {
  it("treats already_reacted as success", () => {
    expect(classifySlackReactionError({ data: { error: "already_reacted" } })).toEqual({ ok: true, alreadyPresent: true });
  });

  it("classifies permanent and retryable errors", () => {
    expect(classifySlackReactionError({ data: { error: "invalid_name" } })).toMatchObject({ ok: false, retryable: false });
    expect(classifySlackReactionError({ code: "slack_webapi_rate_limited_error", retryAfter: 30 })).toEqual({
      ok: false,
      retryable: true,
      code: "ratelimited",
      retryAfterSeconds: 30
    });
  });
});

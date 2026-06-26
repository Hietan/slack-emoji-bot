import { describe, expect, it } from "vitest";
import { decideSlackEvent } from "../../src/domain/slack-event.js";
import type { NormalizedText } from "../../src/shared/text-normalizer.js";

const normalized: NormalizedText = { analysisText: "hello", textSha256: "a".repeat(64) };

function envelope(event: Record<string, unknown>) {
  return {
    type: "event_callback",
    team_id: "T1",
    api_app_id: "A1",
    event_id: "Ev1",
    event_time: 1712345678,
    event: {
      type: "message",
      channel_type: "channel",
      channel: "C1",
      user: "U1",
      ts: "1712345678.123456",
      text: "hello",
      ...event
    }
  };
}

describe("decideSlackEvent", () => {
  it("accepts top-level ordinary messages in configured public channels", () => {
    const result = decideSlackEvent(envelope({}), normalized, {
      teamId: "T1",
      apiAppId: "A1",
      targetChannelIds: new Set(["C1"]),
      targetUserIds: new Set(["U1"])
    });
    expect(result.accepted).toBe(true);
  });

  it.each([
    { input: { type: "url_verification" }, text: normalized, reason: "unsupported_envelope" },
    { input: { type: "event_callback", team_id: "T2" }, text: normalized, reason: "unsupported_envelope" },
    { input: { type: "event_callback", api_app_id: "A2" }, text: normalized, reason: "unsupported_envelope" },
    { input: { type: "event_callback", event_id: undefined }, text: normalized, reason: "unsupported_envelope" },
    { input: { type: "event_callback", event_time: undefined }, text: normalized, reason: "unsupported_envelope" },
    { input: { ...envelope({}), event: { type: "reaction_added" } }, text: normalized, reason: "unsupported_event_type" },
    { input: envelope({ channel: undefined }), text: normalized, reason: "channel_not_configured" },
    { input: envelope({ channel: "C2" }), text: normalized, reason: "channel_not_configured" },
    { input: envelope({ user: "U2" }), text: normalized, reason: "user_not_configured" },
    { input: envelope({ thread_ts: "1712345678.123456" }), text: normalized, reason: "thread_reply" },
    { input: envelope({ subtype: "message_changed" }), text: normalized, reason: "message_subtype" },
    { input: envelope({ bot_id: "B1" }), text: normalized, reason: "bot_message" },
    { input: envelope({ app_id: "A2" }), text: normalized, reason: "bot_message" },
    { input: envelope({ hidden: true }), text: normalized, reason: "hidden_message" },
    { input: envelope({ user: undefined }), text: normalized, reason: "missing_user" },
    { input: envelope({ user: "" }), text: normalized, reason: "missing_user" },
    { input: envelope({ ts: "bad" }), text: normalized, reason: "invalid_timestamp" },
    { input: envelope({ channel_type: "im" }), text: normalized, reason: "unsupported_channel_type" },
    { input: envelope({}), text: { analysisText: "", textSha256: "a".repeat(64) }, reason: "empty_text" }
  ])("ignores $reason", ({ input, text, reason }) => {
    const result = decideSlackEvent(input, text, {
      teamId: "T1",
      apiAppId: "A1",
      targetChannelIds: new Set(["C1"]),
      targetUserIds: new Set(["U1"])
    });
    expect(result).toMatchObject({ accepted: false, reason });
  });
});

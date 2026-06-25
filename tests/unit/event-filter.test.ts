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
      targetChannelIds: new Set(["C1"])
    });
    expect(result.accepted).toBe(true);
  });

  it.each([
    [{ channel: "C2" }, "channel_not_configured"],
    [{ thread_ts: "1712345678.123456" }, "thread_reply"],
    [{ subtype: "message_changed" }, "message_subtype"],
    [{ bot_id: "B1" }, "bot_message"],
    [{ app_id: "A2" }, "bot_message"],
    [{ hidden: true }, "hidden_message"],
    [{ user: "" }, "missing_user"],
    [{ ts: "bad" }, "invalid_timestamp"],
    [{ channel_type: "im" }, "unsupported_channel_type"]
  ])("ignores %j as %s", (override, reason) => {
    const result = decideSlackEvent(envelope(override), normalized, {
      teamId: "T1",
      apiAppId: "A1",
      targetChannelIds: new Set(["C1"])
    });
    expect(result).toMatchObject({ accepted: false, reason });
  });
});

import { describe, expect, it, vi } from "vitest";
import { receiveSlackEvent } from "../../src/application/receive-slack-event.js";
import type { EnqueueTaskResult } from "../../src/application/ports/task-queue.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";

const envelope = {
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
    text: "hello <@U123>"
  }
};

describe("receiveSlackEvent", () => {
  it("normalizes text and enqueues a task payload", async () => {
    let capturedPayload: TaskPayload | null = null;
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn((payload: TaskPayload) => {
      capturedPayload = payload;
      return Promise.resolve<EnqueueTaskResult>("created");
    });
    const result = await receiveSlackEvent({
      envelope,
      rawText: "hello <@U123>",
      config: {
        teamId: "T1",
        apiAppId: "A1",
        targetChannelIds: new Set(["C1"]),
        maxAnalysisTextChars: 2000
      },
      taskQueue: { enqueue },
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    expect(result).toEqual({ ok: true, accepted: true, duplicateTask: false });
    expect(capturedPayload).toMatchObject({ analysisText: "hello @user", schemaVersion: 1 });
  });

  it("returns ignored reasons without enqueueing", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const result = await receiveSlackEvent({
      envelope: { ...envelope, event: { ...envelope.event, thread_ts: "1712345678.123456" } },
      rawText: "hello",
      config: {
        teamId: "T1",
        apiAppId: "A1",
        targetChannelIds: new Set(["C1"]),
        maxAnalysisTextChars: 2000
      },
      taskQueue: { enqueue },
      clock: { now: () => new Date("2026-06-25T00:00:00.000Z") }
    });
    expect(result).toEqual({ ok: true, accepted: false, reason: "thread_reply" });
    expect(enqueue).not.toHaveBeenCalled();
  });
});

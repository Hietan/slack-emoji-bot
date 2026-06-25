import { createHmac } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { EnqueueTaskResult, TaskQueue } from "../../src/application/ports/task-queue.js";
import type { ReceiverEnv } from "../../src/config/receiver-env.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { createReceiverApp } from "../../src/receiver/app.js";

const env: ReceiverEnv = {
  PORT: 8080,
  SLACK_SIGNING_SECRET: "secret",
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1",
  GCP_PROJECT_ID: "project",
  GCP_LOCATION: "asia-northeast1",
  CLOUD_TASKS_QUEUE_ID: "emoji-reaction-jobs",
  WORKER_URL: "https://worker.example.com",
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: "task@example.iam.gserviceaccount.com",
  MAX_ANALYSIS_TEXT_CHARS: 2000,
  targetChannelSet: new Set(["C1"])
};

const clock = { now: () => new Date("2026-06-25T00:00:00.000Z") };

function signedPost(body: unknown) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(clock.now().getTime() / 1000));
  const signature = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  return { raw, timestamp, signature };
}

describe("receiver app", () => {
  it("enqueues one task for a valid signed Slack event", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const taskQueue: TaskQueue = { enqueue };
    const app = createReceiverApp({ env, taskQueue, clock });
    const body = {
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
        text: "hello"
      }
    };
    const signed = signedPost(body);
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", signed.timestamp)
      .set("x-slack-signature", signed.signature)
      .send(signed.raw);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, accepted: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns url verification challenge after signature verification", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const taskQueue: TaskQueue = { enqueue };
    const app = createReceiverApp({ env, taskQueue, clock });
    const signed = signedPost({ type: "url_verification", challenge: "abc" });
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", signed.timestamp)
      .set("x-slack-signature", signed.signature)
      .send(signed.raw);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ challenge: "abc" });
    expect(enqueue).not.toHaveBeenCalled();
  });
});

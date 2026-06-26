import { createHmac } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { EnqueueTaskResult, TaskQueue } from "../../src/application/ports/task-queue.js";
import type { ReceiverEnv } from "../../src/config/receiver-env.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { createReceiverApp } from "../../src/receiver/app.js";

const env: ReceiverEnv = {
  NODE_ENV: "test",
  PORT: 8080,
  LOG_LEVEL: "info",
  SLACK_SIGNING_SECRET: "secret",
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1",
  TARGET_USER_IDS: "U1",
  GCP_PROJECT_ID: "project",
  GCP_REGION: "asia-northeast1",
  CLOUD_TASKS_QUEUE_ID: "emoji-reaction-jobs",
  WORKER_URL: "https://worker.example.com",
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: "task@example.iam.gserviceaccount.com",
  MAX_ANALYSIS_TEXT_CHARS: 2000,
  targetChannelSet: new Set(["C1"]),
  targetUserSet: new Set(["U1"])
};

const clock = { now: () => new Date("2026-06-25T00:00:00.000Z") };

function signedPost(body: unknown) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(clock.now().getTime() / 1000));
  const signature = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  return { raw, timestamp, signature };
}

describe("receiver app", () => {
  it("returns health status without external calls", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const response = await request(app).get("/livez");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "receiver" });
    expect(enqueue).not.toHaveBeenCalled();
  });

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

  it("rate limits repeated Slack event requests", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const taskQueue: TaskQueue = { enqueue };
    const app = createReceiverApp({ env, taskQueue, clock, slackEventsRateLimit: { windowMs: 60_000, limit: 1 } });
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
    const first = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", signed.timestamp)
      .set("x-slack-signature", signed.signature)
      .send(signed.raw);
    const second = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", signed.timestamp)
      .set("x-slack-signature", signed.signature)
      .send(signed.raw);
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ ok: false });
    expect(second.headers["retry-after"]).toBeDefined();
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

  it("rejects invalid signatures before parsing JSON", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", String(Math.floor(clock.now().getTime() / 1000)))
      .set("x-slack-signature", "v0=bad")
      .send("{not json");
    expect(response.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON with a valid signature", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const raw = "{not json";
    const timestamp = String(Math.floor(clock.now().getTime() / 1000));
    const signature = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", timestamp)
      .set("x-slack-signature", signature)
      .send(raw);
    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types before Slack signature handling", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "text/plain")
      .set("x-slack-request-timestamp", String(Math.floor(clock.now().getTime() / 1000)))
      .set("x-slack-signature", "v0=bad")
      .send("not-json");
    expect(response.status).toBe(415);
    expect(response.body).toEqual({ ok: false });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects signed JSON bodies over 256 KiB", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const raw = JSON.stringify({ type: "url_verification", challenge: "x".repeat(262_144) });
    const timestamp = String(Math.floor(clock.now().getTime() / 1000));
    const signature = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", timestamp)
      .set("x-slack-signature", signature)
      .send(raw);
    expect(response.status).toBe(413);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 403 for team or app mismatches", async () => {
    const enqueue: (payload: TaskPayload) => Promise<EnqueueTaskResult> = vi.fn(() => Promise.resolve<EnqueueTaskResult>("created"));
    const app = createReceiverApp({ env, taskQueue: { enqueue }, clock });
    const signed = signedPost({
      type: "event_callback",
      team_id: "T2",
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
    });
    const response = await request(app)
      .post("/slack/events")
      .set("content-type", "application/json")
      .set("x-slack-request-timestamp", signed.timestamp)
      .set("x-slack-signature", signed.signature)
      .send(signed.raw);
    expect(response.status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

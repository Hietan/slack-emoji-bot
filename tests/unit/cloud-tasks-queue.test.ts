import type { CloudTasksClient } from "@google-cloud/tasks";
import { describe, expect, it, vi } from "vitest";
import { CloudTasksQueue } from "../../src/adapters/cloud-tasks-queue.js";
import type { TaskPayload } from "../../src/domain/task-payload.js";
import { taskIdForEvent } from "../../src/shared/crypto.js";

const payload: TaskPayload = {
  schemaVersion: 1,
  eventId: "Ev1",
  teamId: "T1",
  apiAppId: "A1",
  eventTime: 1712345678,
  channelId: "C1",
  messageTs: "1712345678.123456",
  analysisText: "masked text",
  textSha256: "a".repeat(64),
  receivedAt: "2026-06-25T00:00:00.000Z"
};

type CapturedCreateTaskRequest = {
  parent?: string;
  task?: {
    name?: string;
    httpRequest?: {
      httpMethod?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: string | Buffer | Uint8Array;
      oidcToken?: {
        serviceAccountEmail?: string;
        audience?: string;
      };
    };
    dispatchDeadline?: { seconds?: number };
  };
};

function createClient(createTask: (request: CapturedCreateTaskRequest) => Promise<unknown> = vi.fn().mockResolvedValue({})) {
  return {
    queuePath: vi.fn((project: string, location: string, queue: string) => `projects/${project}/locations/${location}/queues/${queue}`),
    taskPath: vi.fn((project: string, location: string, queue: string, task: string) => `projects/${project}/locations/${location}/queues/${queue}/tasks/${task}`),
    createTask
  } as unknown as CloudTasksClient;
}

function createQueue(client: CloudTasksClient) {
  return new CloudTasksQueue({
    projectId: "project",
    location: "asia-northeast1",
    queueId: "emoji-reaction-jobs",
    workerUrl: "https://worker.example.com/",
    serviceAccountEmail: "task@example.iam.gserviceaccount.com",
    client
  });
}

describe("CloudTasksQueue", () => {
  it("creates deterministic OIDC HTTP tasks without forbidden payload fields", async () => {
    let request: CapturedCreateTaskRequest | undefined;
    const createTask = vi.fn((input: CapturedCreateTaskRequest) => {
      request = input;
      return Promise.resolve({});
    });
    const client = createClient(createTask);
    const queue = createQueue(client);

    await expect(queue.enqueue(payload)).resolves.toBe("created");

    expect(createTask).toHaveBeenCalledOnce();
    if (request === undefined) {
      throw new Error("missing createTask request");
    }
    expect(request.parent).toBe("projects/project/locations/asia-northeast1/queues/emoji-reaction-jobs");
    expect(request.task?.name).toBe(`projects/project/locations/asia-northeast1/queues/emoji-reaction-jobs/tasks/${taskIdForEvent(payload.eventId)}`);
    expect(request.task?.httpRequest?.httpMethod).toBe("POST");
    expect(request.task?.httpRequest?.url).toBe("https://worker.example.com/tasks/process");
    expect(request.task?.httpRequest?.oidcToken).toEqual({
      serviceAccountEmail: "task@example.iam.gserviceaccount.com",
      audience: "https://worker.example.com/"
    });
    expect(request.task?.dispatchDeadline).toEqual({ seconds: 120 });

    const encodedBody = request.task?.httpRequest?.body;
    if (typeof encodedBody !== "string") {
      throw new Error("missing task body");
    }
    const body = JSON.parse(Buffer.from(encodedBody, "base64").toString("utf8")) as Record<string, unknown>;
    expect(body).toMatchObject(payload);
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("rawText");
    expect(body).not.toHaveProperty("slackToken");
  });

  it("treats Cloud Tasks ALREADY_EXISTS as an idempotent success", async () => {
    const alreadyExists = new Error("already exists") as Error & { code: number };
    alreadyExists.code = 6;
    const client = createClient(vi.fn(() => Promise.reject(alreadyExists)));
    const queue = createQueue(client);

    await expect(queue.enqueue(payload)).resolves.toBe("already_exists");
  });
});

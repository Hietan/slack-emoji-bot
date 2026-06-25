import { CloudTasksClient } from "@google-cloud/tasks";
import type { TaskQueue, EnqueueTaskResult } from "../application/ports/task-queue.js";
import type { TaskPayload } from "../domain/task-payload.js";
import { taskIdForEvent } from "../shared/crypto.js";

export type CloudTasksQueueOptions = {
  projectId: string;
  location: string;
  queueId: string;
  workerUrl: string;
  serviceAccountEmail: string;
  client?: CloudTasksClient;
};

export class CloudTasksQueue implements TaskQueue {
  readonly #client: CloudTasksClient;
  readonly #options: CloudTasksQueueOptions;

  public constructor(options: CloudTasksQueueOptions) {
    this.#client = options.client ?? new CloudTasksClient();
    this.#options = options;
  }

  public async enqueue(payload: TaskPayload): Promise<EnqueueTaskResult> {
    const parent = this.#client.queuePath(this.#options.projectId, this.#options.location, this.#options.queueId);
    const name = this.#client.taskPath(this.#options.projectId, this.#options.location, this.#options.queueId, taskIdForEvent(payload.eventId));
    const workerUrl = this.#options.workerUrl.replace(/\/$/u, "");
    try {
      await this.#client.createTask({
        parent,
        task: {
          name,
          httpRequest: {
            httpMethod: "POST",
            url: `${workerUrl}/tasks/process`,
            headers: { "Content-Type": "application/json" },
            body: Buffer.from(JSON.stringify(payload)).toString("base64"),
            oidcToken: {
              serviceAccountEmail: this.#options.serviceAccountEmail,
              audience: workerUrl
            }
          },
          dispatchDeadline: { seconds: 120 }
        }
      });
      return "created";
    } catch (error: unknown) {
      if (isAlreadyExists(error)) {
        return "already_exists";
      }
      throw error;
    }
  }
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && Number(error.code) === 6;
}

import type { TaskPayload } from "../../domain/task-payload.js";

export type EnqueueTaskResult = "created" | "already_exists";

export type TaskQueue = {
  enqueue(payload: TaskPayload): Promise<EnqueueTaskResult>;
};

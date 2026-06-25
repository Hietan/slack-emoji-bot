import { CloudTasksQueue } from "../adapters/cloud-tasks-queue.js";
import { loadReceiverEnv } from "../config/receiver-env.js";
import { createLogger } from "../shared/logger.js";
import { createReceiverApp } from "./app.js";

const logger = createLogger("receiver");
const env = loadReceiverEnv();
const taskQueue = new CloudTasksQueue({
  projectId: env.GCP_PROJECT_ID,
  location: env.GCP_REGION,
  queueId: env.CLOUD_TASKS_QUEUE_ID,
  workerUrl: env.WORKER_URL,
  serviceAccountEmail: env.TASK_INVOKER_SERVICE_ACCOUNT_EMAIL
});
const app = createReceiverApp({ env, taskQueue });

app.listen(env.PORT, () => {
  logger.info({ event: "service_started", port: env.PORT }, "receiver started");
});

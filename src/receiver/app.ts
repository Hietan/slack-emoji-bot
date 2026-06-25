import express from "express";
import type { TaskQueue } from "../application/ports/task-queue.js";
import { createSlackEventsRouter } from "./routes/slack-events.js";
import type { ReceiverEnv } from "../config/receiver-env.js";
import type { Clock } from "../shared/clock.js";
import { systemClock } from "../shared/clock.js";

export function createReceiverApp(input: { env: ReceiverEnv; taskQueue: TaskQueue; clock?: Clock }) {
  const app = express();
  const clock = input.clock ?? systemClock;
  app.get("/healthz", (_request, response) => {
    response.status(200).json({ ok: true, service: "receiver" });
  });
  app.use(
    "/slack/events",
    express.raw({ type: "application/json", limit: "256kb" }),
    createSlackEventsRouter({ env: input.env, taskQueue: input.taskQueue, clock })
  );
  return app;
}

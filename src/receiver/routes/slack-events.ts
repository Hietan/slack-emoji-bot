import { Router } from "express";
import type { TaskQueue } from "../../application/ports/task-queue.js";
import { receiveSlackEvent } from "../../application/receive-slack-event.js";
import type { ReceiverEnv } from "../../config/receiver-env.js";
import { slackEnvelopeSchema } from "../../domain/slack-event.js";
import type { Clock } from "../../shared/clock.js";
import { eventIdHash, verifySlackSignature } from "../../shared/crypto.js";
import { createLogger } from "../../shared/logger.js";

export function createSlackEventsRouter(input: { env: ReceiverEnv; taskQueue: TaskQueue; clock: Clock }) {
  const router = Router();
  const logger = createLogger("receiver", input.env.LOG_LEVEL);

  router.post("/", async (request, response) => {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
    const timestamp = headerValue(request.headers["x-slack-request-timestamp"]);
    const signature = headerValue(request.headers["x-slack-signature"]);
    const signatureOk = verifySlackSignature({
      signingSecret: input.env.SLACK_SIGNING_SECRET,
      timestampHeader: timestamp,
      signatureHeader: signature,
      rawBody,
      nowSeconds: Math.floor(input.clock.now().getTime() / 1000)
    });
    if (!signatureOk) {
      logger.warn({ event: "slack_signature_rejected" }, "slack signature rejected");
      response.status(401).json({ ok: false });
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as unknown;
    } catch {
      response.status(400).json({ ok: false });
      return;
    }

    const envelope = slackEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      response.status(400).json({ ok: false });
      return;
    }
    if (envelope.data.type === "url_verification") {
      response.status(200).json({ challenge: envelope.data.challenge ?? "" });
      return;
    }
    if (envelope.data.type === "event_callback") {
      if (envelope.data.team_id !== input.env.SLACK_TEAM_ID || envelope.data.api_app_id !== input.env.SLACK_APP_ID) {
        response.status(403).json({ ok: false });
        return;
      }
    }

    const rawText = extractRawText(envelope.data.event);
    try {
      const result = await receiveSlackEvent({
        envelope: body,
        rawText,
        config: {
          teamId: input.env.SLACK_TEAM_ID,
          apiAppId: input.env.SLACK_APP_ID,
          targetChannelIds: input.env.targetChannelSet,
          maxAnalysisTextChars: input.env.MAX_ANALYSIS_TEXT_CHARS
        },
        taskQueue: input.taskQueue,
        clock: input.clock
      });
      if (!result.accepted) {
        logger.info({ event: "slack_event_ignored", reason: result.reason }, "slack event ignored");
        response.status(200).json({ ok: true, accepted: false, reason: result.reason });
        return;
      }
      logger.info(
        {
          event: result.duplicateTask ? "slack_event_duplicate_task" : "slack_event_enqueued",
          eventIdHash: typeof envelope.data.event_id === "string" ? eventIdHash(envelope.data.event_id) : undefined,
          status: "accepted"
        },
        "slack event accepted"
      );
      response.status(200).json({ ok: true, accepted: true });
    } catch {
      response.status(503).json({ ok: false });
    }
  });

  return router;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function extractRawText(event: unknown): string {
  if (typeof event === "object" && event !== null && "text" in event && typeof event.text === "string") {
    return event.text;
  }
  return "";
}

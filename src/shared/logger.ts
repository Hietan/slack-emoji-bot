import pino from "pino";

export const redactedPaths = [
  "text",
  "analysisText",
  "rawBody",
  "requestBody",
  "responseBody",
  "authorization",
  "slackSignature",
  "slackToken",
  "geminiApiKey",
  "systemInstruction",
  "geminiRawOutput",
  "*.text",
  "*.analysisText",
  "*.rawBody",
  "*.requestBody",
  "*.responseBody",
  "*.authorization",
  "*.slackSignature",
  "*.slackToken",
  "*.geminiApiKey",
  "*.systemInstruction",
  "*.geminiRawOutput"
];

export function createLogger(service: "receiver" | "worker") {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: redactedPaths,
      censor: "[redacted]"
    },
    base: { service }
  });
}

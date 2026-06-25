import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

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

export function createLogger(service: "receiver" | "worker", level: LogLevel = "info") {
  return pino({
    name: service,
    level,
    redact: {
      paths: redactedPaths,
      censor: "[redacted]"
    },
    base: { service }
  });
}

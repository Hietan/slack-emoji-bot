import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import pino from "pino";
import { createLogger, redactedPaths } from "../../src/shared/logger.js";

describe("logger redaction", () => {
  it("uses the validated configured log level", () => {
    expect(createLogger("receiver", "debug").level).toBe("debug");
  });

  it("redacts forbidden top-level and nested fields", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      }
    });
    const logger = pino({ redact: { paths: redactedPaths, censor: "[redacted]" } }, stream);
    logger.info({
      analysisText: "do not log",
      nested: {
        authorization: "Bearer secret",
        geminiRawOutput: "raw"
      },
      safe: "ok"
    });

    const line = lines.join("");
    expect(line).toContain("[redacted]");
    expect(line).toContain("\"safe\":\"ok\"");
    expect(line).not.toContain("do not log");
    expect(line).not.toContain("Bearer secret");
    expect(line).not.toContain("raw");
  });
});

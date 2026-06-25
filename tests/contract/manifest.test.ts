import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadEmojiConfig } from "../../src/config/emoji-config.js";
import { taskPayloadSchema } from "../../src/domain/task-payload.js";

describe("contracts", () => {
  it("Slack manifest has only required MVP scopes and message.channels", () => {
    const manifest = readFileSync("slack/manifest.template.yaml", "utf8");
    expect(manifest).toContain("channels:history");
    expect(manifest).toContain("reactions:write");
    expect(manifest).toContain("emoji:read");
    expect(manifest).toContain("message.channels");
    expect(manifest).not.toContain("chat:write");
  });

  it("default emoji config and task payload schema are valid", () => {
    expect(loadEmojiConfig().fallback).toHaveLength(3);
    expect(taskPayloadSchema.shape.schemaVersion.value).toBe(1);
  });
});

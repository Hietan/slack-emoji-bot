import { describe, expect, it } from "vitest";
import { renderSlackManifest } from "../../scripts/render-slack-manifest.js";

const template = "request_url: ${RECEIVER_URL}/slack/events\n";

describe("renderSlackManifest", () => {
  it("renders a normalized https receiver URL", () => {
    expect(renderSlackManifest(template, "https://receiver.example.com/")).toBe(
      "request_url: https://receiver.example.com/slack/events\n"
    );
  });

  it("rejects missing, non-URL, and non-https receiver URLs", () => {
    expect(() => renderSlackManifest(template, undefined)).toThrow(/RECEIVER_URL/u);
    expect(() => renderSlackManifest(template, "not a url")).toThrow();
    expect(() => renderSlackManifest(template, "http://receiver.example.com")).toThrow(/https/u);
  });
});

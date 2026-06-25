import { describe, expect, it, vi } from "vitest";
import { GeminiEmojiSelector } from "../../src/adapters/gemini-emoji-selector.js";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const candidates = [
  { name: "eyes", kind: "standard" as const, description: "a", useWhen: "when", avoidWhen: "avoid" },
  { name: "thinking_face", kind: "standard" as const, description: "a", useWhen: "when", avoidWhen: "avoid" },
  { name: "memo", kind: "standard" as const, description: "a", useWhen: "when", avoidWhen: "avoid" }
];

describe("GeminiEmojiSelector", () => {
  it("uses structured output and validates returned emoji names", async () => {
    let capturedRequest: GenerateContentParameters | null = null;
    const generateContent = vi.fn((request: GenerateContentParameters) => {
      capturedRequest = request;
      return Promise.resolve({ text: "{\"emojis\":[\"eyes\",\"thinking_face\",\"memo\"]}" } as unknown as GenerateContentResponse);
    });
    const selector = new GeminiEmojiSelector({
      apiKey: "key",
      model: "gemini-2.5-flash-lite",
      client: { generateContent }
    });

    await expect(selector.select({ analysisText: "hello", candidates })).resolves.toEqual({
      names: ["eyes", "thinking_face", "memo"],
      source: "gemini"
    });
    expect(capturedRequest).toMatchObject({
      model: "gemini-2.5-flash-lite",
      store: false,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          additionalProperties: false,
          properties: {
            emojis: {
              minItems: 3,
              maxItems: 3,
              items: { enum: ["eyes", "thinking_face", "memo"] }
            }
          }
        }
      }
    });
  });

  it("rejects extra keys and invalid allowlist output", async () => {
    const generateContent = vi.fn((request: GenerateContentParameters) => {
      expect(request.model).toBe("gemini-2.5-flash-lite");
      return Promise.resolve({ text: "{\"emojis\":[\"eyes\",\"eyes\",\"nope\"],\"note\":\"bad\"}" } as unknown as GenerateContentResponse);
    });
    const selector = new GeminiEmojiSelector({
      apiKey: "key",
      model: "gemini-2.5-flash-lite",
      client: { generateContent }
    });

    await expect(selector.select({ analysisText: "hello", candidates })).rejects.toThrow(/gemini/u);
  });
});

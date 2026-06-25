import type { EmojiSelector } from "../application/ports/emoji-selector.js";
import type { EmojiSelection } from "../domain/emoji.js";
import { validateSelection } from "../domain/emoji.js";

export type GeminiEmojiSelectorOptions = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export class GeminiEmojiSelector implements EmojiSelector {
  readonly #options: GeminiEmojiSelectorOptions;

  public constructor(options: GeminiEmojiSelectorOptions) {
    this.#options = options;
  }

  public async select(input: Parameters<EmojiSelector["select"]>[0]): Promise<EmojiSelection> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.#options.timeoutMs ?? 8000);
    try {
      const response = await (this.#options.fetchFn ?? fetch)(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.#options.model)}:generateContent?key=${encodeURIComponent(this.#options.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: [
                      "Choose exactly three distinct emoji names from the allowlist for this Slack message.",
                      "Return only compact JSON like {\"emoji\":[\"name1\",\"name2\",\"name3\"]}.",
                      `Allowlist: ${input.candidates.map((candidate) => candidate.name).join(", ")}`,
                      `Message: ${input.analysisText}`
                    ].join("\n")
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            },
            safetySettings: [],
            store: false
          })
        }
      );
      if (!response.ok) {
        throw new Error("gemini_unavailable");
      }
      const body: unknown = await response.json();
      const text = extractText(body);
      const parsed = JSON.parse(text) as unknown;
      const names = extractEmojiNames(parsed);
      const selected = validateSelection(names, new Set(input.candidates.map((candidate) => candidate.name)));
      if (selected === null) {
        throw new Error("gemini_invalid_selection");
      }
      return { names: selected, source: "gemini" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractText(body: unknown): string {
  if (typeof body !== "object" || body === null || !("candidates" in body) || !Array.isArray(body.candidates)) {
    throw new Error("gemini_invalid_response");
  }
  const first = body.candidates[0] as unknown;
  if (typeof first !== "object" || first === null || !("content" in first)) {
    throw new Error("gemini_invalid_response");
  }
  const content = first.content as { parts?: Array<{ text?: string }> };
  const text = content.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("gemini_invalid_response");
  }
  return text;
}

function extractEmojiNames(value: unknown): string[] {
  if (typeof value !== "object" || value === null || !("emoji" in value)) {
    throw new Error("gemini_invalid_json");
  }
  const names = value.emoji;
  if (!Array.isArray(names) || !names.every((name) => typeof name === "string")) {
    throw new Error("gemini_invalid_json");
  }
  if (Object.keys(value).length !== 1) {
    throw new Error("gemini_extra_keys");
  }
  return names;
}

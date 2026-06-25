import { describe, expect, it } from "vitest";
import { normalizeAnalysisText } from "../../src/shared/text-normalizer.js";

describe("normalizeAnalysisText", () => {
  it("normalizes, masks identifiers, and trims by code point", () => {
    const result = normalizeAnalysisText(" e\u0301\r\n<@U123> see <https://example.com|docs> a@example.com 😀😀😀 ", 20);
    expect(result.analysisText).toBe("é\n@user see docs [em");
    expect(result.textSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("does not split surrogate pairs", () => {
    const result = normalizeAnalysisText("😀😀😀", 2);
    expect(result.analysisText).toBe("😀😀");
  });
});

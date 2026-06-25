import { describe, expect, it } from "vitest";
import { selectFallback, uniqueThree, validateSelection } from "../../src/domain/emoji.js";

describe("emoji domain", () => {
  it("requires exactly three distinct names", () => {
    expect(uniqueThree(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(uniqueThree(["a", "a", "c"])).toBeNull();
    expect(uniqueThree(["a", "b"])).toBeNull();
  });

  it("validates against the allowlist and selects fallback", () => {
    const allowlist = new Set(["eyes", "white_check_mark", "tada"]);
    expect(validateSelection(["eyes", "nope", "tada"], allowlist)).toBeNull();
    expect(
      selectFallback(
        {
          candidates: [],
          fallback: ["eyes", "white_check_mark", "tada"]
        },
        allowlist
      )
    ).toEqual({ names: ["eyes", "white_check_mark", "tada"], source: "fallback" });
    expect(() =>
      selectFallback(
        {
          candidates: [],
          fallback: ["eyes", "white_check_mark", "tada"]
        },
        new Set(["eyes"])
      )
    ).toThrow(/fallback/u);
  });
});

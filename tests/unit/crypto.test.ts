import { describe, expect, it } from "vitest";
import { eventIdHash, sha256Hex, taskIdForEvent } from "../../src/shared/crypto.js";

describe("crypto helpers", () => {
  it("creates stable hashes and task IDs", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(eventIdHash("Ev1")).toHaveLength(16);
    expect(taskIdForEvent("Ev1")).toMatch(/^slack-event-[a-f0-9]{40}$/u);
  });
});

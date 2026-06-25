import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "../../src/shared/crypto.js";

describe("verifySlackSignature", () => {
  it("accepts a valid raw-body signature", () => {
    const rawBody = Buffer.from("{\"ok\":true}");
    const timestamp = "1712345678";
    const secret = "secret";
    const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody.toString("utf8")}`).digest("hex")}`;
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestampHeader: timestamp,
        signatureHeader: signature,
        rawBody,
        nowSeconds: 1712345678
      })
    ).toBe(true);
  });

  it("rejects stale timestamps and missing headers", () => {
    expect(
      verifySlackSignature({
        signingSecret: "secret",
        timestampHeader: "1712340000",
        signatureHeader: "v0=bad",
        rawBody: Buffer.from("{}"),
        nowSeconds: 1712345678
      })
    ).toBe(false);
    expect(
      verifySlackSignature({
        signingSecret: "secret",
        timestampHeader: undefined,
        signatureHeader: undefined,
        rawBody: Buffer.from("{}"),
        nowSeconds: 1712345678
      })
    ).toBe(false);
  });
});

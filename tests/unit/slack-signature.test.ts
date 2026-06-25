import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "../../src/shared/crypto.js";

describe("verifySlackSignature", () => {
  const sign = (secret: string, timestamp: string, rawBody: Buffer): string =>
    `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:`, "utf8").update(rawBody).digest("hex")}`;

  it("accepts a valid raw-body signature", () => {
    const rawBody = Buffer.from("{\"ok\":true}");
    const timestamp = "1712345678";
    const secret = "secret";
    const signature = sign(secret, timestamp, rawBody);
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

  it("uses raw bytes instead of a UTF-8 replacement string", () => {
    const rawBody = Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]);
    const timestamp = "1712345678";
    const secret = "secret";
    const signature = sign(secret, timestamp, rawBody);

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

  it("rejects malformed timestamp headers", () => {
    const rawBody = Buffer.from("{}");
    const timestamp = "1712345678junk";
    const signature = sign("secret", timestamp, rawBody);

    expect(
      verifySlackSignature({
        signingSecret: "secret",
        timestampHeader: timestamp,
        signatureHeader: signature,
        rawBody,
        nowSeconds: 1712345678
      })
    ).toBe(false);
  });
});

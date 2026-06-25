import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function eventIdHash(eventId: string): string {
  return sha256Hex(eventId).slice(0, 16);
}

export function taskIdForEvent(eventId: string): string {
  return `slack-event-${sha256Hex(eventId).slice(0, 40)}`;
}

export function verifySlackSignature(args: {
  signingSecret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: Buffer;
  nowSeconds: number;
}): boolean {
  const { signingSecret, timestampHeader, signatureHeader, rawBody, nowSeconds } = args;
  if (timestampHeader === undefined || signatureHeader === undefined) {
    return false;
  }
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
    return false;
  }
  const base = `v0:${timestampHeader}:${rawBody.toString("utf8")}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

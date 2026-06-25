import { sha256Hex } from "./crypto.js";

export type NormalizedText = {
  analysisText: string;
  textSha256: string;
};

export function normalizeAnalysisText(text: string, maxCodePoints: number): NormalizedText {
  const textSha256 = sha256Hex(text);
  let value = text
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .trim()
    .replace(/<@U[A-Z0-9]+>/gu, "@user")
    .replace(/<!subteam\^[^>]+>/gu, "@group")
    .replace(/<#C[A-Z0-9]+(?:\|([^>]+))?>/gu, (_match: string, label: string | undefined) => (label ?? "channel").replace(/^/u, "#"))
    .replace(/<https?:\/\/[^>|]+(?:\|([^>]+))?>/giu, (_match: string, label: string | undefined) => label ?? "[link]")
    .replace(/https?:\/\/[^\s<]+/giu, "[link]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/[^\P{Cc}\n\t]/gu, "");
  value = Array.from(value).slice(0, maxCodePoints).join("").trim();
  return { analysisText: value, textSha256 };
}

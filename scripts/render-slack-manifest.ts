import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function renderSlackManifest(template: string, receiverUrl: string | undefined): string {
  if (receiverUrl === undefined || receiverUrl.length === 0) {
    throw new Error("RECEIVER_URL is required");
  }

  const url = new URL(receiverUrl);
  if (url.protocol !== "https:") {
    throw new Error("RECEIVER_URL must use https");
  }

  return template.replaceAll("${RECEIVER_URL}", url.toString().replace(/\/$/u, ""));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const template = readFileSync("slack/manifest.template.yaml", "utf8");
  process.stdout.write(renderSlackManifest(template, process.env.RECEIVER_URL));
}

import { readFileSync } from "node:fs";

const receiverUrl = process.env.RECEIVER_URL;
if (receiverUrl === undefined || receiverUrl.length === 0) {
  throw new Error("RECEIVER_URL is required");
}

const template = readFileSync("slack/manifest.template.yaml", "utf8");
process.stdout.write(template.replaceAll("${RECEIVER_URL}", receiverUrl.replace(/\/$/u, "")));

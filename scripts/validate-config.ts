import { readFileSync } from "node:fs";
import YAML from "yaml";
import { parseEmojiConfig } from "../src/config/emoji-config.js";
import { loadReceiverEnv } from "../src/config/receiver-env.js";
import { loadWorkerEnv } from "../src/config/worker-env.js";

const config = YAML.parse(readFileSync("config/emoji.default.yaml", "utf8")) as unknown;
parseEmojiConfig(config);
const exampleEnv = parseEnvFile(readFileSync(".env.example", "utf8"));
loadReceiverEnv(exampleEnv);
loadWorkerEnv({
  ...exampleEnv,
  GEMINI_UNPAID_TERMS_ACKNOWLEDGED: "true"
});
console.log("config ok");

function parseEnvFile(content: string): NodeJS.ProcessEnv {
  const parsed: NodeJS.ProcessEnv = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      throw new Error(`invalid env example line: ${trimmed}`);
    }
    parsed[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }
  return parsed;
}

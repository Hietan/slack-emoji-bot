import { readFileSync } from "node:fs";
import YAML from "yaml";
import { parseEmojiConfig } from "../src/config/emoji-config.js";

const config = YAML.parse(readFileSync("config/emoji.default.yaml", "utf8")) as unknown;
parseEmojiConfig(config);
console.log("config ok");

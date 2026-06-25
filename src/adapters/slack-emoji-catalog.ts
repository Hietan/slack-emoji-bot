import { WebClient } from "@slack/web-api";
import type { EmojiCatalog } from "../application/ports/emoji-catalog.js";

export class SlackEmojiCatalog implements EmojiCatalog {
  readonly #client: WebClient;

  public constructor(token: string, client = new WebClient(token)) {
    this.#client = client;
  }

  public async listCustomEmojiNames(): Promise<ReadonlySet<string>> {
    const response = await this.#client.emoji.list();
    const emoji = response.emoji;
    if (emoji === undefined) {
      return new Set<string>();
    }
    return new Set(Object.keys(emoji));
  }
}

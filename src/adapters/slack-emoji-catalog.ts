import { WebClient } from "@slack/web-api";
import type { EmojiCatalog } from "../application/ports/emoji-catalog.js";

export class SlackEmojiCatalog implements EmojiCatalog {
  readonly #client: WebClient;
  readonly #ttlMs: number;
  #cache: { expiresAt: number; names: ReadonlySet<string> } | null = null;

  public constructor(token: string, client = new WebClient(token), ttlSeconds = 600) {
    this.#client = client;
    this.#ttlMs = ttlSeconds * 1000;
  }

  public async listCustomEmojiNames(): Promise<ReadonlySet<string>> {
    const now = Date.now();
    if (this.#cache !== null && this.#cache.expiresAt > now) {
      return this.#cache.names;
    }
    const response = await this.#client.emoji.list();
    const emoji = response.emoji;
    if (emoji === undefined) {
      const names = new Set<string>();
      this.#cache = { expiresAt: now + this.#ttlMs, names };
      return names;
    }
    const names = new Set(Object.keys(emoji));
    this.#cache = { expiresAt: now + this.#ttlMs, names };
    return names;
  }
}

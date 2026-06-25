import type { WebClient } from "@slack/web-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlackEmojiCatalog } from "../../src/adapters/slack-emoji-catalog.js";

describe("SlackEmojiCatalog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads custom emoji names and caches them until TTL expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T00:00:00.000Z"));
    const list = vi
      .fn()
      .mockResolvedValueOnce({ emoji: { shipit: "https://example.com/shipit.png" } })
      .mockResolvedValueOnce({ emoji: { party: "https://example.com/party.png" } });
    const client = { emoji: { list } } as unknown as WebClient;
    const catalog = new SlackEmojiCatalog("test-slack-token", client, 600);

    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set(["shipit"]));
    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set(["shipit"]));
    expect(list).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-06-25T00:10:01.000Z"));
    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set(["party"]));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("caches an empty set when Slack returns no emoji map", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true });
    const client = { emoji: { list } } as unknown as WebClient;
    const catalog = new SlackEmojiCatalog("test-slack-token", client, 600);

    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set<string>());
    await expect(catalog.listCustomEmojiNames()).resolves.toEqual(new Set<string>());
    expect(list).toHaveBeenCalledTimes(1);
  });
});

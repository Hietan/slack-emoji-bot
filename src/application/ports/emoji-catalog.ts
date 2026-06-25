export type EmojiCatalog = {
  listCustomEmojiNames(): Promise<ReadonlySet<string>>;
};

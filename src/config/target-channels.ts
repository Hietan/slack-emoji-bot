export function parseTargetChannelSet(value: string): ReadonlySet<string> {
  const ids = value.split(",").map((item) => item.trim());
  if (ids.length === 0 || ids.some((id) => id.length === 0)) {
    throw new Error("TARGET_CHANNEL_IDS must not contain empty channel IDs");
  }
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("TARGET_CHANNEL_IDS must not contain duplicate channel IDs");
  }
  return unique;
}

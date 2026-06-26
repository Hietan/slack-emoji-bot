export function parseTargetChannelSet(value: string): ReadonlySet<string> {
  return parseTargetIdSet(value, "TARGET_CHANNEL_IDS");
}

export function parseTargetUserSet(value: string): ReadonlySet<string> {
  return parseTargetIdSet(value, "TARGET_USER_IDS");
}

function parseTargetIdSet(value: string, name: string): ReadonlySet<string> {
  const ids = value.split(",").map((item) => item.trim());
  if (ids.length === 0 || ids.some((id) => id.length === 0)) {
    throw new Error(`${name} must not contain empty IDs`);
  }
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error(`${name} must not contain duplicate IDs`);
  }
  return unique;
}

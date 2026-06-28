# Emoji Catalog

The emoji catalog controls what Gemini is allowed to select. Gemini cannot return arbitrary emoji names; output is validated against the candidate allowlist before Slack API calls.

The default catalog is [config/emoji.default.yaml](../config/emoji.default.yaml).

## Shape

```yaml
version: 1
fallback:
  - eyes
  - thinking_face
  - memo

emojis:
  - name: eyes
    kind: standard
    enabled: true
    description: Neutral acknowledgement or attention.
    use_when: Announcements, sharing, review requests, or situational awareness.
    avoid_when: Personal content where attention may feel intrusive.
```

## Rules

- `name` is the Slack reaction name without colons.
- `kind` is `standard` or `custom`.
- `enabled: false` keeps an entry documented but out of model candidates.
- fallback entries must be enabled emoji candidates.
- names must be unique.
- descriptions should explain the social reaction, not just the icon shape.
- `use_when` and `avoid_when` should help Gemini choose between similar reactions.

## Standard Emoji

Standard emoji candidates should be broadly available in Slack and should represent teammate reactions such as acknowledgement, appreciation, caution, investigation, support, celebration, or light humor.

When adding standard emoji:

1. Use the Slack reaction name, not the Unicode glyph.
2. Avoid adding many near-duplicates.
3. Prefer reactions that are useful across many work contexts.
4. Keep fallback reactions neutral and safe.
5. Run `pnpm validate:config`.

## Custom Emoji

Custom emoji are included only when Slack `emoji.list` reports that the workspace has the same name. Missing custom emoji are ignored for that event; standard emoji remain available when they are part of the configured catalog.

When adding custom emoji:

1. Upload the emoji to Slack first or coordinate with the workspace admin.
2. Use the exact Slack custom emoji name without colons.
3. Keep names compatible with the config schema: lowercase letters, numbers, `_`, `+`, and `-`.
4. Write descriptions by reaction intent, not by file artwork alone.
5. Test with `DRY_RUN=true` before enabling real reactions.

## Default Catalog

The default catalog ships with:

- 40 enabled standard emoji candidates.
- `eyes`, `thinking_face`, and `memo` as deterministic fallback reactions.

The default catalog is intentionally portable so a new workspace can use the bot without uploading custom emoji.

## Local Catalogs

Local-only catalogs can be kept out of Git with `config/emoji.local.yaml`. Point a local runtime at that file by setting `EMOJI_CONFIG_PATH=config/emoji.local.yaml`, for example in an ignored `.env.local`.

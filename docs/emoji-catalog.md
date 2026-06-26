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
  - name: clap
    kind: standard
    enabled: true
    description: Recognition for effort or achievement.
    use_when: Achievements, good presentations, or useful contributions.
    avoid_when: Serious problems or unresolved failures.
```

## Rules

- `name` is the Slack reaction name without colons.
- `kind` is `standard` or `custom`.
- `enabled: false` keeps an entry documented but out of model candidates.
- fallback entries must be enabled standard emoji.
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

Custom emoji are included only when Slack `emoji.list` reports that the workspace has the same name. Missing custom emoji are ignored for that event; standard emoji remain available.

When adding custom emoji:

1. Upload the emoji to Slack first or coordinate with the workspace admin.
2. Use the exact Slack custom emoji name without colons.
3. Keep names compatible with the config schema: lowercase letters, numbers, `_`, `+`, and `-`.
4. Write descriptions by reaction intent, not by file artwork alone.
5. Test with `DRY_RUN=true` before enabling real reactions.

## `v0.1.0` Defaults

`v0.1.0` ships with:

- 40 enabled standard emoji candidates.
- 30 enabled custom emoji candidates from the `neco202511-2` set.
- `eyes`, `thinking_face`, and `memo` as deterministic fallback reactions.

Custom emoji from the default catalog do not require code changes, but they do require the same names to exist in the target Slack workspace.

# Operations

This guide covers routine operation after the bot is deployed.

## Rollout Checklist

1. Deploy with `dry_run=true`.
2. Confirm Slack URL verification succeeds.
3. Invite the bot to the target public channel.
4. Confirm target channel IDs and target user IDs are configured.
5. Send a harmless top-level message from a configured user.
6. Check receiver and worker logs for accepted processing without copying message text.
7. Redeploy with `dry_run=false`.
8. Confirm exactly three reactions are added.
9. Confirm messages from non-target users are ignored before Cloud Tasks and Gemini.

## Health Checks

- Receiver `/livez` should return success.
- Worker should be `Ready` in Cloud Run.
- Cloud Tasks should not accumulate retrying tasks under normal traffic.
- Firestore process records should contain metadata and emoji names, not message text.

## Useful Places To Inspect

- Cloud Run request count, error count, latency, and revision.
- Cloud Tasks queue depth, retry count, and dead-letter behavior if configured later.
- Firestore read/write volume and old process records.
- Artifact Registry image storage.
- Vertex AI or Gemini usage and quota.
- Slack app Event Subscriptions and OAuth scopes.

## Safe Debugging

Use redacted logs only. Do not paste Slack message text, signing secrets, bot tokens, Gemini keys, raw request bodies, raw response bodies, or Authorization headers into issues, chats, or release notes.

Prefer these identifiers:

- Cloud Run revision name.
- Git SHA image tag.
- hashed event ID from logs.
- selected emoji names.
- error code or stage.

## Common Changes

### Add A Target Channel

1. Invite the bot to the Slack channel.
2. Add the channel ID to `TARGET_CHANNEL_IDS`.
3. Redeploy.
4. Test with `DRY_RUN=true` first when possible.

### Add A Target User

1. Add the Slack user ID to `TARGET_USER_IDS`.
2. Redeploy.
3. Confirm messages from other users are ignored.

### Add Custom Emoji

1. Upload the emoji to Slack.
2. Add an enabled `kind: custom` entry to `config/emoji.default.yaml`.
3. Run `pnpm validate:config`.
4. Redeploy.
5. Check for `custom_emoji_candidates_missing` warnings.

## Incident Response

If the bot reacts inappropriately:

1. Set `DRY_RUN=true` and redeploy.
2. Inspect selected emoji names and fallback source without copying message text.
3. Adjust the prompt or emoji catalog.
4. Add tests when the behavior is reproducible without private content.

If a secret leaks:

1. Rotate it in Slack, Google, or Gemini.
2. Add a new Secret Manager version.
3. Redeploy affected services.
4. Inspect logs for exposure.
5. Avoid public issue details until the credential is invalidated.

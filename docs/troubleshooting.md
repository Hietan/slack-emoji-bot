# Troubleshooting

Use synthetic test messages only when debugging. Do not paste Slack message text, signing secrets, bot tokens, Gemini keys, Authorization headers, Slack signatures, or raw Gemini output into issues, logs, or release notes.

## Slack URL Verification Fails

- Confirm `RECEIVER_URL` uses `https` and ends with `/slack/events` in the rendered Slack manifest.
- Confirm `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`, and `SLACK_APP_ID` match the Slack app.
- Check receiver logs for `slack_signature_rejected`, but do not log or copy request bodies or signature header values.

## No Reactions Are Added

- Confirm the bot is invited to the target public channel.
- Confirm `TARGET_CHANNEL_IDS` contains Slack channel IDs such as `C0123456789`, not channel names.
- Confirm the event is a top-level public-channel message, not a thread reply, bot post, file-only post, edited message, DM, or private-channel message.
- Check Cloud Tasks and worker logs for `worker_lease_acquired` and `worker_completed`.

## Only Fallback Reactions Appear

- Confirm `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_UNPAID_TERMS_ACKNOWLEDGED` are configured.
- Confirm the worker can reach Gemini within `GEMINI_TIMEOUT_MS`.
- Gemini errors intentionally fall back without retrying Gemini for that event.

## Custom Emoji Are Ignored

- Confirm the Slack app has the `emoji:read` scope and has been reinstalled after scope changes.
- Confirm each `kind: custom` emoji exists in the workspace with the same name and no colons.
- `missing_scope` for `emoji.list` is logged as a configuration error and processing continues with standard emoji.

## Duplicate Or Partial Reactions

- Duplicate Slack events and duplicate Cloud Tasks are expected under retries.
- Firestore stores `selectedEmojis` and `completedEmojis`; retries should add only unfinished reactions.
- `already_reacted` is treated as success.

## Deployment Fails On Secrets

- Run the targeted Terraform apply from `docs/deployment.md` first so Secret Manager containers exist.
- Add versions for `slack-emoji-bot-slack-signing-secret`, `slack-emoji-bot-slack-bot-token`, and `slack-emoji-bot-gemini-api-key` before the first full deploy.
- Do not put secret values in Terraform variables, `.env` files committed to Git, GitHub Actions logs, or release notes.

## Cost Looks Higher Than Expected

- Cloud Run min instances are `0`, but this project does not guarantee zero cost.
- Inspect Cloud Run request counts, Cloud Tasks retry counts, Firestore operations, Artifact Registry storage, and Gemini usage.
- Reduce traffic, fix retry loops, and keep `DRY_RUN=true` until the workspace behavior is verified.

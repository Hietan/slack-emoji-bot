# Configuration

Runtime configuration is supplied through environment variables. Use `.env.example` as a template, but store real secret values in Secret Manager or an equivalent secret store.

## Required Identity

| Name | Used by | Description |
| --- | --- | --- |
| `SLACK_TEAM_ID` | receiver, worker | Slack workspace team ID. |
| `SLACK_APP_ID` | receiver, worker | Slack app ID. |
| `TARGET_CHANNEL_IDS` | receiver, worker | Comma-separated public channel IDs that the bot may process. |
| `TARGET_USER_IDS` | receiver, worker | Comma-separated Slack user IDs whose messages may receive reactions. |

The bot ignores messages outside the configured channel and user sets before Cloud Tasks, Gemini, or Slack reactions are called.

## Receiver

| Name | Default | Description |
| --- | --- | --- |
| `SLACK_SIGNING_SECRET` | none | Slack signing secret. Store as a secret. |
| `GCP_PROJECT_ID` | none | Hosting GCP project ID. |
| `GCP_REGION` | `asia-northeast1` | Cloud Run and Cloud Tasks region. |
| `CLOUD_TASKS_QUEUE_ID` | `emoji-reaction-jobs` | Queue for worker tasks. |
| `WORKER_URL` | none | Private worker service URL. |
| `TASK_INVOKER_SERVICE_ACCOUNT_EMAIL` | none | Service account used to invoke worker tasks. |
| `MAX_ANALYSIS_TEXT_CHARS` | `2000` | Maximum normalized text length sent to the worker. |

## Worker

| Name | Default | Description |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | none | Slack bot token. Store as a secret. |
| `GEMINI_BACKEND` | `vertex` | `vertex` or `developer`. |
| `GEMINI_API_KEY` | none | Required only when `GEMINI_BACKEND=developer`. Store as a secret. |
| `GEMINI_PROJECT_ID` | none | Required when `GEMINI_BACKEND=vertex`. |
| `GEMINI_LOCATION` | `global` | Gemini API location. |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Model used for emoji selection. |
| `GEMINI_TIMEOUT_MS` | `8000` | Gemini request timeout. |
| `SLACK_TIMEOUT_MS` | `5000` | Slack Web API timeout. |
| `GEMINI_UNPAID_TERMS_ACKNOWLEDGED` | `false` | Must be `true` in production. |
| `EMOJI_CONFIG_PATH` | `/app/config/emoji.default.yaml` | YAML emoji catalog path. |
| `CUSTOM_EMOJI_CACHE_TTL_SECONDS` | `600` | In-memory cache TTL for `emoji.list`. |
| `FIRESTORE_DATABASE_ID` | `(default)` | Firestore database ID. |
| `PROCESS_RECORD_TTL_DAYS` | `7` | Processing record retention window. |
| `DRY_RUN` | `false` | When `true`, skip Slack `reactions.add`. |

## Deployment Inputs

The `Deploy` workflow accepts the main operator-controlled settings:

- `project_id`
- `region`
- `slack_team_id`
- `slack_app_id`
- `target_channel_ids`
- `target_user_ids`
- `dry_run`
- `gemini_unpaid_terms_acknowledged`
- `image_version_tag`

Keep `dry_run=true` until Slack Event Subscription verification, channel invitation, and first workspace checks are complete.

## Secret Handling

Do not commit real `.env` files. Do not pass secret values through Terraform variables or workflow inputs.

Required Secret Manager secret containers:

- `slack-emoji-bot-slack-signing-secret`
- `slack-emoji-bot-slack-bot-token`

Optional when using Gemini Developer API:

- `slack-emoji-bot-gemini-api-key`

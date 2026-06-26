# Deployment

Read [Configuration](configuration.md) before deploying, and use [Operations](operations.md) for rollout checks after Cloud Run is live.

1. Create a hosting GCP project and enable billing.
2. Use the hosting GCP project for Vertex AI Gemini calls.
3. Create a Slack app with `slack/manifest.bootstrap.yaml` or manually.
4. Record Slack App ID, Team ID, and Signing Secret.
5. Install the bot to the workspace and record the Bot Token.
6. Record target Slack channel IDs and target Slack user IDs.
7. Review Gemini service terms and decide whether `GEMINI_UNPAID_TERMS_ACKNOWLEDGED=true` is acceptable for your workspace.
8. Run the Terraform state and GitHub Workload Identity Federation bootstrap instructions in `infra/bootstrap`.
9. Create the API, Artifact Registry, and Secret Manager containers before the first full deploy:
    ```bash
    terraform -chdir=infra/terraform init
    terraform -chdir=infra/terraform apply \
      -target=google_project_service.required \
      -target=google_artifact_registry_repository.repo \
      -target=google_secret_manager_secret.secrets \
      -var "project_id=YOUR_PROJECT_ID" \
      -var "region=asia-northeast1" \
      -var "slack_team_id=YOUR_SLACK_TEAM_ID" \
      -var "slack_app_id=YOUR_SLACK_APP_ID" \
      -var "target_channel_ids=C0123456789" \
      -var "target_user_ids=U0123456789" \
      -var "dry_run=true" \
      -var "gemini_unpaid_terms_acknowledged=false" \
      -var "image=asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/slack-emoji-bot/slack-emoji-bot:bootstrap"
    ```
10. Add these two required secret values as Secret Manager versions before creating Cloud Run services:
    - `slack-emoji-bot-slack-signing-secret`
    - `slack-emoji-bot-slack-bot-token`
    - `slack-emoji-bot-gemini-api-key` is only needed when using `GEMINI_BACKEND=developer`.
11. Run `.github/workflows/deploy.yml` manually. Keep `dry_run` set to `true` for the first deployment.
12. Render `slack/manifest.template.yaml` with the receiver URL from the deploy workflow summary:
    ```bash
    RECEIVER_URL="https://RECEIVER_URL" pnpm render:slack-manifest > slack/manifest.rendered.yaml
    ```
13. Complete Slack Event Subscription URL verification.
14. Invite the bot to target public channels.
15. Set `TARGET_CHANNEL_IDS` and `TARGET_USER_IDS`, then redeploy.
16. Verify with `DRY_RUN=true`.
17. Set `DRY_RUN=false` and verify that a configured user's top-level message receives three distinct reactions.

For `v0.1.0`, the recommended first production scope is one public channel and one configured target user. Expand channel and user lists only after the first channel behaves as expected.

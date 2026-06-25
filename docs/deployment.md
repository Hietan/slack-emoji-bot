# Deployment

1. Create a hosting GCP project and enable billing.
2. Prepare a separate Gemini API key project in Google AI Studio if desired.
3. Create a Slack app with `slack/manifest.bootstrap.yaml` or manually.
4. Record Slack App ID, Team ID, and Signing Secret.
5. Install the bot to the workspace and record the Bot Token.
6. Create a Gemini API key.
7. Review Gemini unpaid service terms and decide whether `GEMINI_UNPAID_TERMS_ACKNOWLEDGED=true` is acceptable for your workspace.
8. Run the Terraform state and GitHub Workload Identity Federation bootstrap instructions in `infra/bootstrap`.
9. Apply Terraform in `infra/terraform` once to create the Secret Manager containers and GCP runtime resources.
10. Add these three secret values as Secret Manager versions:
    - `slack-emoji-bot-slack-signing-secret`
    - `slack-emoji-bot-slack-bot-token`
    - `slack-emoji-bot-gemini-api-key`
11. Render `slack/manifest.template.yaml` with the receiver URL:
    ```bash
    RECEIVER_URL="https://RECEIVER_URL" pnpm render:slack-manifest > slack/manifest.rendered.yaml
    ```
12. Complete Slack Event Subscription URL verification.
13. Invite the bot to target public channels.
14. Set `TARGET_CHANNEL_IDS` and redeploy.
15. Verify with `DRY_RUN=true`.
16. Set `DRY_RUN=false` and verify that a top-level message receives three distinct reactions.

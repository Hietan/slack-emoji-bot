# Deployment

1. Create a hosting GCP project and enable billing.
2. Prepare a separate Gemini API key project in Google AI Studio if desired.
3. Create a Slack app with `slack/manifest.bootstrap.yaml` or manually.
4. Record Slack App ID, Team ID, and Signing Secret.
5. Install the bot to the workspace and record the Bot Token.
6. Create a Gemini API key.
6. Review Gemini unpaid service terms and decide whether `GEMINI_UNPAID_TERMS_ACKNOWLEDGED=true` is acceptable for your workspace.
7. Run the Terraform bootstrap instructions in `infra/bootstrap`.
8. Add the three secret values to Secret Manager.
9. Apply Terraform in `infra/terraform`.
10. Render `slack/manifest.template.yaml` with the receiver URL.
11. Complete Slack Event Subscription URL verification.
12. Invite the bot to target public channels.
13. Set `TARGET_CHANNEL_IDS` and redeploy.
14. Verify with `DRY_RUN=true`.
15. Set `DRY_RUN=false` and verify that a top-level message receives three reactions.

# Release Process

This project uses Semantic Versioning and `vMAJOR.MINOR.PATCH` Git tags.

## Prepare `v1.0.0`

1. Confirm that all local and CI checks pass:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test --coverage
   pnpm test:integration
   pnpm build
   pnpm validate:config
   pnpm scan:sensitive
   terraform -chdir=infra/terraform fmt -check
   terraform -chdir=infra/terraform init -backend=false
   terraform -chdir=infra/terraform validate
   docker build .
   ```
2. Confirm that `DRY_RUN=true` has been tested in a real Slack workspace.
3. Confirm that `DRY_RUN=false` adds exactly three distinct reactions to a top-level target-channel message.
4. Confirm that Firestore and Cloud Logging do not contain Slack message text, Gemini input, raw Gemini output, Slack signatures, Slack tokens, or Gemini keys.
5. Move `CHANGELOG.md` entries from `[Unreleased]` into the release section.
6. Commit the changelog update.
7. Create and push the tag:
   ```bash
   git tag v1.0.0
   git push origin main v1.0.0
   ```
8. Create a GitHub Release for `v1.0.0` using the changelog entries.
9. Build and publish container images tagged with both the Git SHA and `v1.0.0`; do not rely on `latest` as the only deployable tag.

## Release Notes Checklist

- Mention whether Gemini unpaid service terms are required for the deployment mode.
- Mention any Slack scopes or GCP permissions added since the previous release.
- Mention migration steps for environment variables, Terraform state, or Firestore schema changes.
- Do not include Slack message text, raw Gemini responses, API keys, bot tokens, or signing secrets.

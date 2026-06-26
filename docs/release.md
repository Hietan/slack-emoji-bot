# Release Process

This project uses Semantic Versioning and `vMAJOR.MINOR.PATCH` Git tags.

Use patch releases for fixes and hardening, minor releases for new operator-visible features, and major releases for breaking configuration, Terraform, API, or data-shape changes.

## Prepare A Release

Set the release version first:

```bash
export VERSION="0.1.0"
```

1. Confirm the package version, changelog, and docs refer to the intended version.
2. Confirm all local and CI checks pass:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test:coverage
   pnpm test:integration
   pnpm build
   pnpm validate:config
   pnpm scan:sensitive
   pnpm scan:production
   terraform -chdir=infra/terraform fmt -check
   terraform -chdir=infra/terraform init -backend=false
   terraform -chdir=infra/terraform validate
   docker build .
   ```
3. Confirm `DRY_RUN=true` has been tested in a real Slack workspace.
4. Confirm `DRY_RUN=false` adds exactly three distinct reactions to a top-level target-channel message from a configured user.
5. Confirm Firestore and Cloud Logging do not contain Slack message text, Gemini input, raw Gemini output, Slack signatures, Slack tokens, or Gemini keys.
6. Move `CHANGELOG.md` entries from `[Unreleased]` into the release section.
7. Commit the release documentation update.
8. Create and push the tag:
   ```bash
   git tag "v${VERSION}"
   git push origin main "v${VERSION}"
   ```
9. Create a GitHub Release for `v${VERSION}` using the changelog entries.
10. Build and publish container images tagged with both the Git SHA and `v${VERSION}`; do not rely on `latest` as the only deployable tag.

## Release Notes Checklist

- Mention whether Gemini unpaid service terms are required for the deployment mode.
- Mention any Slack scopes or GCP permissions added since the previous release.
- Mention migration steps for environment variables, Terraform state, Firestore records, or Slack app setup.
- Mention whether custom emoji names must be created in the Slack workspace before they are used.
- Do not include Slack message text, raw Gemini responses, API keys, bot tokens, signing secrets, or Authorization headers.

## `v0.1.0` Readiness

`v0.1.0` is the first self-hosted MVP release. It is considered ready when the deployed workflow has been verified with:

- one configured public channel;
- at least one configured target user;
- `DRY_RUN=false`;
- Gemini selection or fallback;
- no sensitive text in durable storage or logs.

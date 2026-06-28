# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

No unreleased changes yet.

## [0.1.3] - 2026-06-28

### Changed

- Deploy workflow can restore an ignored local emoji catalog from GitHub Secrets and point Cloud Run at it.

## [0.1.2] - 2026-06-28

### Changed

- Default emoji catalog now uses only standard Slack emoji, with local custom catalogs kept outside Git.

## [0.1.1] - 2026-06-26

### Security

- Added rate limiting to the Slack Events endpoint to close CodeQL `js/missing-rate-limiting`.

## [0.1.0] - 2026-06-26

### Added

- Initial self-hosted Slack emoji reaction bot.
- Public Cloud Run receiver with Slack request signature verification.
- Private Cloud Run worker for idempotent reaction processing.
- Slack Events API filtering for configured public channels and configured users.
- Cloud Tasks enqueueing with deterministic task IDs.
- Firestore-backed leases, completion tracking, and duplicate delivery handling.
- Gemini emoji selection with structured output and deterministic fallback.
- Prompt guidance that treats emoji as teammate reactions rather than literal labels.
- Default emoji catalog with 40 standard candidates and 30 custom candidates.
- Slack custom emoji catalog validation through `emoji.list`.
- Terraform module for the default GCP deployment.
- GitHub Actions CI, CodeQL, Dependabot, and manual deployment workflow.
- Privacy, threat model, troubleshooting, release, and deployment documentation.

### Security

- Workload Identity Federation deployment flow without long-lived service account keys.
- Secret Manager-based runtime secret injection.
- Redaction and scan checks for message text, API keys, signatures, and raw external responses.
- Allowlist-constrained model output validation before Slack API calls.

[Unreleased]: https://github.com/Hietan/slack-emoji-bot/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/Hietan/slack-emoji-bot/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Hietan/slack-emoji-bot/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Hietan/slack-emoji-bot/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Hietan/slack-emoji-bot/releases/tag/v0.1.0

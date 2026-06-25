# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

### Added

- Initial MVP receiver and worker implementation.
- Slack Events API receiver with request signature verification.
- Cloud Tasks enqueueing with deterministic task IDs.
- Firestore-backed idempotency and reaction progress tracking.
- Gemini emoji selection with deterministic fallback.
- Slack custom emoji catalog validation.
- Terraform, GitHub Actions, and self-hosting documentation.

### Security

- Workload Identity Federation deployment flow.
- Secret Manager-based runtime secret injection.
- Redaction tests for message text, API keys, signatures, and raw external responses.

## [1.0.0] - TBD

### Added

- First stable self-hosted MVP release.

[Unreleased]: https://github.com/Hietan/slack-emoji-bot/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Hietan/slack-emoji-bot/releases/tag/v1.0.0

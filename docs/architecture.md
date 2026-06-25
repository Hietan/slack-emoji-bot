# Architecture

Emoji Bot uses two Cloud Run services.

- `receiver` is public and handles Slack signature verification, URL verification, event filtering, text normalization, and Cloud Tasks enqueueing.
- `worker` is private and handles idempotent processing, custom emoji lookup, Gemini selection, fallback selection, Slack reaction calls, and Firestore progress updates.

Domain and application code do not depend on Express, Slack SDK, Google SDKs, or Firestore types. External services are accessed through ports in `src/application/ports` and adapters in `src/adapters`.

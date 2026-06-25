# Threat Model

Primary risks:

- Forged Slack requests.
- Replay attacks outside Slack's five-minute window.
- Accidental logging of secrets or message text.
- Model output causing reactions outside the allowlist.
- Duplicate Cloud Tasks causing more than three bot reactions.
- Public access to the worker service.

Controls:

- HMAC verification over raw Slack request bodies.
- Timestamp window enforcement.
- Pino redaction and limited structured logs.
- Zod validation and allowlist-constrained emoji selection.
- Firestore leases and persisted selected emoji names.
- Cloud Run IAM for worker invocation.

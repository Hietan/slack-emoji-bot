# Security Policy

## Supported Versions

`0.1.x` receives best-effort security fixes while the project is in MVP status. Patch releases may include security hardening, dependency updates, documentation corrections, and deployment fixes.

## Reporting a Vulnerability

Please report vulnerabilities privately to the repository owner. Do not put tokens, signing secrets, API keys, Slack message text, raw request bodies, or exploit details in public issues.

Useful reports include:

- affected version, image tag, or Git SHA;
- component involved: receiver, worker, Terraform, Slack app, or documentation;
- redacted reproduction steps;
- expected impact;
- whether secrets or message text may have been exposed.

## Secret Rotation

If a Slack token, Slack signing secret, Gemini API key, or deployment credential leaks:

1. Revoke or rotate it in the provider console.
2. Add a new Secret Manager version.
3. Redeploy receiver or worker services that use the secret.
4. Inspect Cloud Logging and GitHub Actions logs for accidental disclosure.
5. Treat any exposed Slack message text as sensitive incident data.

## Handling Sensitive Data

The bot must not persist Slack message text, Gemini input, raw Gemini output, Authorization headers, Slack signatures, Slack tokens, or Gemini keys.

Any change that touches logging, task payloads, Firestore records, GitHub Actions logs, model prompts, or external API responses must include a privacy review and relevant tests.

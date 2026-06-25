# Security Policy

## Supported Versions

MVP releases are supported once tagged as `v1.x`.

## Reporting a Vulnerability

Please report vulnerabilities privately to the repository owner. Do not put tokens, signing secrets, API keys, message text, or exploit details in public issues.

## Secret Rotation

If a Slack token, Slack signing secret, or Gemini API key leaks:

1. Revoke or rotate it in the provider console.
2. Add a new Secret Manager version.
3. Redeploy receiver or worker services that use the secret.
4. Inspect Cloud Logging and GitHub Actions logs for accidental disclosure.

## Handling Sensitive Data

The bot must not persist Slack message text, Gemini input, raw Gemini output, Authorization headers, Slack signatures, Slack tokens, or Gemini keys.

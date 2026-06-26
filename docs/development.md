# Development

This project is organized around small domain code and replaceable infrastructure adapters.

## Local Setup

```bash
corepack enable
pnpm install --frozen-lockfile
```

Common checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm validate:config
```

Full release-oriented check:

```bash
pnpm check
pnpm test:coverage
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
docker build .
```

## Code Boundaries

| Area | Responsibility |
| --- | --- |
| `src/domain` | Pure schemas, state, emoji validation, and Slack event decisions. |
| `src/application` | Use cases and interfaces to external systems. |
| `src/application/ports` | Contracts for queues, stores, model selection, catalog lookup, and reactions. |
| `src/adapters` | Google, Slack, Gemini, and Firestore integrations. |
| `src/receiver` | Public HTTP service for Slack Events API. |
| `src/worker` | Private HTTP service for Cloud Tasks. |
| `config` | Emoji catalog YAML. |
| `infra/terraform` | Default GCP deployment. |

Domain and application code should not import Express, Slack SDK, Google SDKs, or Firestore types.

## Adding A Provider

To add a different queue, store, model provider, or reaction target:

1. Keep the existing application port if the behavior fits.
2. Add a new adapter in `src/adapters`.
3. Wire the adapter in `src/receiver/main.ts` or `src/worker/main.ts`.
4. Add focused unit tests for adapter error mapping.
5. Add integration tests around the application behavior.
6. Update deployment and configuration docs.

## Changing Slack Event Scope

Changes to event scope are high impact. Update all of these together:

- Slack manifest and scopes.
- `src/domain/slack-event.ts`.
- receiver tests.
- `SPECIFICATION.md`.
- README and deployment docs.
- privacy and threat model docs when data exposure changes.

## Changing Model Behavior

Changes to prompts, structured output, candidate schemas, fallback rules, or model configuration should include:

- unit tests for invalid model output;
- config validation when catalog shape changes;
- a note in `CHANGELOG.md`;
- review of privacy implications.

## Logging Rule

Logs may include hashed event identifiers, stage names, error classes, selected emoji names, and configuration-safe metadata.

Logs must not include Slack message text, Gemini input, raw Gemini output, request bodies, response bodies, tokens, signatures, API keys, or Authorization headers.

# Contributing

Thanks for improving Slack Emoji Bot. The project is small on purpose: preserve the privacy, cost, and operational boundaries unless a change clearly needs to expand them.

## Development Setup

Use Node.js 24 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

For a faster loop while editing:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Project Shape

- `src/domain`: pure validation, state, and domain types.
- `src/application`: use cases and ports.
- `src/adapters`: Slack, Gemini, Firestore, and Cloud Tasks implementations.
- `src/receiver`: public Slack Events API service.
- `src/worker`: private Cloud Tasks worker service.
- `config`: emoji catalog configuration.
- `infra/terraform`: default GCP deployment.
- `docs`: operator, maintainer, and release documentation.
- `tests`: unit, contract, integration, and fixture code.

Prefer adding behavior behind an application port when it touches an external provider. Keep domain and application code independent from Express, Slack SDK, Google SDKs, and Terraform.

## Change Guidelines

- Use Conventional Commits where possible.
- Add or update tests for behavior changes.
- Update docs when changing setup, environment variables, Slack scopes, GCP permissions, Terraform resources, prompts, model behavior, privacy handling, or operational procedures.
- Keep `SPECIFICATION.md` in sync for normative behavior changes.
- Add an ADR in `docs/adr/` for architecture decisions that affect deployment topology, storage, permissions, provider boundaries, or data retention.

## Privacy And Security

Never add logs or persisted fields that include Slack message text, Gemini input, raw Gemini output, request bodies, response bodies, Slack signatures, Slack tokens, Gemini API keys, or Authorization headers.

Before opening a PR that changes receiver, worker, logging, tasks, Firestore, prompts, or external API handling, run:

```bash
pnpm scan:sensitive
pnpm scan:production
```

## Local Validation

Use the full local check before release-oriented changes:

```bash
pnpm check
pnpm test:coverage
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
docker build .
```

Some Terraform and Docker checks require local tools and network access.

## Pull Requests

A good PR includes:

- a short summary of behavior and operator impact;
- tests run;
- docs updated or a note explaining why docs are unchanged;
- privacy/security considerations;
- migration notes for environment variables, Terraform state, Slack app settings, Firestore records, or emoji catalog changes.

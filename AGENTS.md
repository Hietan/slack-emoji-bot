# AGENTS.md

## Project identity

- Repository name: `slack-emoji-bot`.
- Slack app and bot display name: `Emoji Bot`.
- The normative product and implementation requirements are in `SPECIFICATION.md`.
- Read `SPECIFICATION.md` before editing code.

## Source of truth

1. Follow `SPECIFICATION.md` exactly.
2. Do not change fixed architecture, scopes, event filters, reaction count, data retention, privacy behavior, or error classification without an ADR in `docs/adr/` and an explicit user request.
3. When code and specification differ, update the code to match the specification unless the user explicitly requests a specification change.
4. Keep MVP scope strict. Do not add OAuth, multiple workspaces, private channels, a UI, slash commands, file analysis, or custom emoji upload.

## Required stack

- Node.js 24 LTS.
- TypeScript with strict compiler options and ESM.
- pnpm 10 and a committed `pnpm-lock.yaml`.
- Express 5, Zod, Vitest, Pino.
- Two Cloud Run entrypoints: `receiver` and `worker`.
- Cloud Tasks for asynchronous delivery.
- Firestore for idempotency and partial-progress state.
- Gemini Interactions API with `gemini-2.5-flash-lite` and `store: false`.
- Terraform for GCP infrastructure.

## Non-negotiable behavior

- Process only configured public-channel top-level ordinary messages.
- Ignore all messages with `thread_ts`, any `subtype`, `bot_id`, `app_id`, or `hidden: true`.
- Add exactly three distinct reactions selected only from the validated allowlist.
- Never call Gemini more than once after a valid selection has been persisted for an event.
- Treat Slack `already_reacted` as success.
- Resume only unfinished reactions after a retry.
- Never persist or log Slack message text, Gemini input, raw Gemini output, credentials, signatures, or authorization headers.
- Do not use `Promise.all` for the three Slack reaction calls.
- Do not add new Slack scopes unless the specification is changed first.

## Architecture rules

- Keep domain and application code independent of Express and external SDK types.
- Define ports in `src/application/ports/` and adapters in `src/adapters/`.
- Validate all external inputs as `unknown` with Zod.
- Do not use `any`.
- Inject time and identifier generation where deterministic tests require them.
- Map external errors to explicit domain error codes. Do not log raw external error objects when they may contain request or response bodies.

## Security and privacy review

For every change, verify all of the following:

- Slack signature verification still uses the raw request body and a five-minute timestamp window.
- The worker remains inaccessible to unauthenticated callers.
- No secret is added to source control, fixtures, Terraform state, or workflow logs.
- No message text or Gemini content is written to Firestore or logs.
- Prompt input remains untrusted data and model output remains allowlist-constrained.
- GitHub Actions use Workload Identity Federation rather than service-account JSON keys.

## Commands to run

Before declaring a task complete, run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test --coverage
pnpm test:integration
pnpm build
pnpm validate:config
```

When Terraform changes, also run:

```bash
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform validate
```

When Docker-related files change, build the image locally.

## Testing expectations

- Add or update tests with every behavior change.
- Cover normal, error, retry, duplicate, and boundary cases.
- Maintain at least 90% branch and statement coverage in domain and application code，and at least 80% statement coverage overall.
- Use synthetic fixtures only. Never copy real Slack messages, tokens, IDs tied to individuals, or API responses containing user data.
- A test must prove that partial Slack success resumes without selecting a new set of emojis.

## Change discipline

- Make the smallest complete change that satisfies the task.
- Do not perform unrelated refactors.
- Do not leave `TODO`, `FIXME`, disabled tests, empty implementations, or production mocks.
- Commit generated lockfile changes when dependencies change.
- Update `.env.example`, Slack manifests, Terraform, tests, and documentation together when configuration changes.
- Record a material architectural decision in `docs/adr/NNNN-title.md`.

## Review guidelines

During review, prioritize:

1. Privacy or credential leakage.
2. Authentication and Slack signature verification regressions.
3. Duplicate reactions or broken idempotency.
4. Message-filtering regressions that react to threads or bots.
5. Incorrect retry classification that causes loss or endless retries.
6. Divergence from `SPECIFICATION.md`.
7. Missing tests or documentation.

Report findings with file and line references，severity，impact，and a concrete correction.

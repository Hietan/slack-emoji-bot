# Contributing

Use Node.js 24 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm validate:config
pnpm scan:sensitive
```

Conventional Commits are recommended. Specification changes require an issue, an update to `SPECIFICATION.md`, and an ADR in `docs/adr/`.

Do not add Slack scopes, external permissions, environment variables, or persistent data fields without updating tests and documentation in the same change.

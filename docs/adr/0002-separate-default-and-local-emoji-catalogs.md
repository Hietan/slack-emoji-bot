# 0002: Separate Default and Local Emoji Catalogs

## Status

Accepted

## Context

The project should be easy for other Slack workspaces to adopt from Git without first uploading workspace-specific custom emoji. At the same time, individual operators may want personal or workspace-specific catalogs.

## Decision

Keep `config/emoji.default.yaml` portable by using only standard Slack emoji. Put personal catalogs in ignored local files such as `config/emoji.local.yaml`, and point local runtimes at them with `EMOJI_CONFIG_PATH`.

Fallback entries may be any enabled candidate, not only standard emoji, so local custom-only catalogs can still define deterministic fallback reactions.

## Consequences

Fresh clones can use the committed default catalog immediately. Workspace-specific custom emoji names and preferences stay out of the public repository.

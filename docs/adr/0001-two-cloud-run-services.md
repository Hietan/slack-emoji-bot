# 0001: Use Two Cloud Run Services

## Status

Accepted

## Context

Slack requires fast acknowledgement, while Gemini and Slack Web API calls can be slow or retryable.

## Decision

Use a public `receiver` service for Slack Events API and a private `worker` service invoked by Cloud Tasks.

## Consequences

The worker can require IAM authentication, and receiver responses stay short. Deployment needs two Cloud Run services and a task invoker service account.

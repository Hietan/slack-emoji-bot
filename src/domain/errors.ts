export type IgnoredReason =
  | "unsupported_envelope"
  | "unsupported_event_type"
  | "unsupported_channel_type"
  | "channel_not_configured"
  | "user_not_configured"
  | "message_subtype"
  | "thread_reply"
  | "bot_message"
  | "hidden_message"
  | "missing_user"
  | "invalid_timestamp"
  | "empty_text";

export type WorkerOutcome =
  | { kind: "completed" }
  | { kind: "already_completed" }
  | { kind: "invalid_task" }
  | { kind: "lease_conflict" }
  | { kind: "retryable"; retryAfterSeconds?: number };

export type SlackReactionErrorCode =
  | "already_reacted"
  | "too_many_emoji"
  | "too_many_reactions"
  | "invalid_auth"
  | "token_expired"
  | "token_revoked"
  | "missing_scope"
  | "no_permission"
  | "channel_not_found"
  | "message_not_found"
  | "bad_timestamp"
  | "is_archived"
  | "thread_locked"
  | "not_reactable"
  | "team_access_not_granted"
  | "invalid_name"
  | "ratelimited"
  | "internal_error"
  | "fatal_error"
  | "service_unavailable"
  | "request_timeout"
  | "external_channel_migrating"
  | "team_added_to_org"
  | "unknown_error";

export type ReactionResult =
  | { ok: true; alreadyPresent?: boolean }
  | { ok: false; retryable: boolean; code: SlackReactionErrorCode; retryAfterSeconds?: number };

export class LeaseConflictError extends Error {
  public constructor() {
    super("lease_conflict");
  }
}

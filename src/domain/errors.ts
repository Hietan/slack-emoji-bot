export type IgnoredReason =
  | "unsupported_envelope"
  | "unsupported_event_type"
  | "unsupported_channel_type"
  | "channel_not_configured"
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
  | "no_reaction"
  | "not_in_channel"
  | "channel_not_found"
  | "message_not_found"
  | "invalid_name"
  | "ratelimited"
  | "service_unavailable"
  | "unknown_error";

export type ReactionResult =
  | { ok: true; alreadyPresent?: boolean }
  | { ok: false; retryable: boolean; code: SlackReactionErrorCode; retryAfterSeconds?: number };

export class LeaseConflictError extends Error {
  public constructor() {
    super("lease_conflict");
  }
}

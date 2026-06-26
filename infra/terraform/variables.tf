variable "project_id" {
  type        = string
  description = "GCP project ID."
}

variable "region" {
  type        = string
  description = "GCP region for Cloud Run, Cloud Tasks, and Artifact Registry."
  default     = "asia-northeast1"
}

variable "target_channel_ids" {
  type        = string
  description = "Comma-separated Slack public channel IDs."
}

variable "target_user_ids" {
  type        = string
  description = "Comma-separated Slack user IDs whose messages should receive reactions."
}

variable "slack_team_id" {
  type        = string
  description = "Slack team ID."
}

variable "slack_app_id" {
  type        = string
  description = "Slack app ID."
}

variable "dry_run" {
  type        = bool
  description = "Whether the worker should skip Slack reactions."
  default     = true
}

variable "gemini_unpaid_terms_acknowledged" {
  type        = bool
  description = "Required acknowledgement before enabling Gemini in production."
  default     = false
}

variable "image" {
  type        = string
  description = "Container image URI."
}

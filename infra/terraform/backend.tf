terraform {
  backend "gcs" {
    bucket = "slack-emoji-bot-500602-terraform-state"
    prefix = "slack-emoji-bot"
  }
}

locals {
  service_prefix = "slack-emoji-bot"
  queue_id       = "emoji-reaction-jobs"
}

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "cloudtasks.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com"
  ])

  project = var.project_id
  service = each.value
}

resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = local.service_prefix
  format        = "DOCKER"
  depends_on    = [google_project_service.required]
}

resource "google_secret_manager_secret" "secrets" {
  for_each = toset([
    "${local.service_prefix}-slack-signing-secret",
    "${local.service_prefix}-slack-bot-token",
    "${local.service_prefix}-gemini-api-key"
  ])

  secret_id = each.value
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_service_account" "receiver" {
  account_id   = "${local.service_prefix}-receiver"
  display_name = "Emoji Bot receiver"
}

resource "google_service_account" "worker" {
  account_id   = "${local.service_prefix}-worker"
  display_name = "Emoji Bot worker"
}

resource "google_service_account" "task_invoker" {
  account_id   = "${local.service_prefix}-task-invoker"
  display_name = "Emoji Bot Cloud Tasks invoker"
}

resource "google_cloud_tasks_queue" "queue" {
  name     = local.queue_id
  location = var.region

  rate_limits {
    max_dispatches_per_second = 2
    max_concurrent_dispatches = 4
  }

  retry_config {
    max_attempts  = 6
    min_backoff   = "5s"
    max_backoff   = "300s"
    max_doublings = 5
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "receiver" {
  name     = "${local.service_prefix}-receiver"
  location = var.region

  template {
    service_account = google_service_account.receiver.email
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image   = var.image
      command = ["node", "dist/receiver/main.js"]
      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
      env {
        name  = "SLACK_TEAM_ID"
        value = var.slack_team_id
      }
      env {
        name  = "SLACK_APP_ID"
        value = var.slack_app_id
      }
      env {
        name  = "TARGET_CHANNEL_IDS"
        value = var.target_channel_ids
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_LOCATION"
        value = var.region
      }
      env {
        name  = "CLOUD_TASKS_QUEUE_ID"
        value = google_cloud_tasks_queue.queue.name
      }
      env {
        name  = "WORKER_URL"
        value = google_cloud_run_v2_service.worker.uri
      }
      env {
        name  = "TASK_INVOKER_SERVICE_ACCOUNT_EMAIL"
        value = google_service_account.task_invoker.email
      }
      env {
        name = "SLACK_SIGNING_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["${local.service_prefix}-slack-signing-secret"].secret_id
            version = "latest"
          }
        }
      }
    }
    timeout = "10s"
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "${local.service_prefix}-worker"
  location = var.region

  template {
    service_account = google_service_account.worker.email
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image   = var.image
      command = ["node", "dist/worker/main.js"]
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      env {
        name  = "SLACK_TEAM_ID"
        value = var.slack_team_id
      }
      env {
        name  = "SLACK_APP_ID"
        value = var.slack_app_id
      }
      env {
        name  = "TARGET_CHANNEL_IDS"
        value = var.target_channel_ids
      }
      env {
        name  = "DRY_RUN"
        value = tostring(var.dry_run)
      }
      env {
        name = "SLACK_BOT_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["${local.service_prefix}-slack-bot-token"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["${local.service_prefix}-gemini-api-key"].secret_id
            version = "latest"
          }
        }
      }
    }
    timeout = "120s"
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "receiver_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.receiver.location
  name     = google_cloud_run_v2_service.receiver.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "worker_task_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.worker.location
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.task_invoker.email}"
}

resource "google_project_iam_member" "receiver_tasks" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.receiver.email}"
}

resource "google_project_iam_member" "worker_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "receiver_task_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.receiver.email}"
}

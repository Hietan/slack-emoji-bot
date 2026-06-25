output "receiver_url" {
  value       = google_cloud_run_v2_service.receiver.uri
  description = "Slack Events API request URL base."
}

output "worker_url" {
  value       = google_cloud_run_v2_service.worker.uri
  description = "Private worker service URL."
}

output "artifact_registry_repository" {
  value       = google_artifact_registry_repository.repo.name
  description = "Artifact Registry Docker repository resource name."
}

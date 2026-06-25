# Terraform State Bootstrap

Create a GCS bucket for Terraform state before running the main Terraform module.

```bash
gcloud storage buckets create gs://YOUR_STATE_BUCKET --location=asia-northeast1 --uniform-bucket-level-access
gcloud storage buckets update gs://YOUR_STATE_BUCKET --versioning
```

Then configure the backend in `infra/terraform/backend.tf`.

# Bootstrap

Run these one-time setup steps before using the main Terraform module and the deploy workflow.

## Terraform State

Create a GCS bucket for Terraform state before running the main Terraform module.

```bash
gcloud storage buckets create gs://YOUR_STATE_BUCKET --location=asia-northeast1 --uniform-bucket-level-access
gcloud storage buckets update gs://YOUR_STATE_BUCKET --versioning
```

Then configure the backend in `infra/terraform/backend.tf`.

## GitHub Workload Identity Federation

The deploy workflow must authenticate with Workload Identity Federation. Do not create or store a long-lived service account JSON key.

Set these placeholders before running the commands:

```bash
export PROJECT_ID="your-gcp-project"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export GITHUB_OWNER="your-github-owner"
export GITHUB_REPO="slack-emoji-bot"
export REGION="asia-northeast1"
export POOL_ID="github-actions"
export PROVIDER_ID="github"
export DEPLOYER_SA="slack-emoji-bot-github-deployer"
```

Create the deployer service account:

```bash
gcloud iam service-accounts create "$DEPLOYER_SA" \
  --project="$PROJECT_ID" \
  --display-name="Emoji Bot GitHub deployer"
```

Create the Workload Identity pool and provider:

```bash
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${GITHUB_OWNER}/${GITHUB_REPO}'"
```

Allow only this repository to impersonate the deployer service account:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"
```

Grant the deployer the permissions needed to build images and apply the Terraform module:

```bash
for role in \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/cloudtasks.admin \
  roles/datastore.owner \
  roles/secretmanager.admin \
  roles/iam.serviceAccountAdmin \
  roles/iam.serviceAccountUser \
  roles/serviceusage.serviceUsageAdmin
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done
```

Add these GitHub repository secrets:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github
GCP_DEPLOYER_SERVICE_ACCOUNT=slack-emoji-bot-github-deployer@PROJECT_ID.iam.gserviceaccount.com
```

Before the first full deploy, run the targeted Terraform apply from `docs/deployment.md` to create the Secret Manager containers, then add the three secret versions. Do not wait until after Cloud Run creation, because the services reference the `latest` secret versions at deploy time.

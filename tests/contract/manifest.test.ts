import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadEmojiConfig } from "../../src/config/emoji-config.js";
import { taskPayloadSchema } from "../../src/domain/task-payload.js";

describe("contracts", () => {
  it("Slack manifest has only required MVP scopes and message.channels", () => {
    const manifest = readFileSync("slack/manifest.template.yaml", "utf8");
    expect(manifest).toContain("channels:history");
    expect(manifest).toContain("reactions:write");
    expect(manifest).toContain("emoji:read");
    expect(manifest).toContain("message.channels");
    expect(manifest).not.toContain("chat:write");
  });

  it("default emoji config and task payload schema are valid", () => {
    expect(loadEmojiConfig().fallback).toHaveLength(3);
    expect(taskPayloadSchema.shape.schemaVersion.value).toBe(1);
  });

  it(".env.example documents all runtime configuration keys without real secrets", () => {
    const envExample = readFileSync(".env.example", "utf8");
    for (const key of [
      "NODE_ENV",
      "PORT",
      "LOG_LEVEL",
      "SLACK_TEAM_ID",
      "SLACK_APP_ID",
      "TARGET_CHANNEL_IDS",
      "SLACK_SIGNING_SECRET",
      "GCP_PROJECT_ID",
      "GCP_REGION",
      "CLOUD_TASKS_QUEUE_ID",
      "WORKER_URL",
      "TASK_INVOKER_SERVICE_ACCOUNT_EMAIL",
      "MAX_ANALYSIS_TEXT_CHARS",
      "SLACK_BOT_TOKEN",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GEMINI_TIMEOUT_MS",
      "SLACK_TIMEOUT_MS",
      "GEMINI_UNPAID_TERMS_ACKNOWLEDGED",
      "EMOJI_CONFIG_PATH",
      "CUSTOM_EMOJI_CACHE_TTL_SECONDS",
      "FIRESTORE_DATABASE_ID",
      "PROCESS_RECORD_TTL_DAYS",
      "DRY_RUN"
    ]) {
      expect(envExample).toContain(`${key}=`);
    }
    expect(envExample).not.toMatch(/AIza[0-9A-Za-z_-]+/u);
    expect(envExample).not.toMatch(/xox[baprs]-[0-9A-Za-z-]+/u);
  });

  it("task payload rejects fields that must never be enqueued", () => {
    const payload = {
      schemaVersion: 1,
      eventId: "Ev1",
      teamId: "T1",
      apiAppId: "A1",
      eventTime: 1712345678,
      channelId: "C1",
      messageTs: "1712345678.123456",
      analysisText: "hello",
      textSha256: "a".repeat(64),
      receivedAt: "2026-06-25T00:00:00.000Z",
      userId: "U1",
      rawText: "secret"
    };
    expect(taskPayloadSchema.strict().safeParse(payload).success).toBe(false);
  });

  it("OSS repository support files are present", () => {
    for (const path of [
      "README.md",
      "LICENSE",
      "SECURITY.md",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      ".github/pull_request_template.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      "docs/assets/demo-placeholder.svg"
    ]) {
      expect(existsSync(path), path).toBe(true);
    }

    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("Demo Placeholder");
    expect(readme).toContain("docs/assets/demo-placeholder.svg");

    const license = readFileSync("LICENSE", "utf8");
    expect(license).toContain("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION");
    expect(license).toContain("Grant of Patent License");
  });

  it("deployment uses Workload Identity Federation without long-lived JSON keys", () => {
    const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(deployWorkflow).toContain("google-github-actions/auth@");
    expect(deployWorkflow).toContain("workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}");
    expect(deployWorkflow).toContain("service_account: ${{ secrets.GCP_DEPLOYER_SERVICE_ACCOUNT }}");
    expect(deployWorkflow).toContain("id-token: write");
    expect(deployWorkflow).not.toContain("credentials_json");
    expect(deployWorkflow).not.toContain("GOOGLE_APPLICATION_CREDENTIALS");

    const bootstrap = readFileSync("infra/bootstrap/README.md", "utf8");
    expect(bootstrap).toContain("Workload Identity Federation");
    expect(bootstrap).toContain("GCP_WORKLOAD_IDENTITY_PROVIDER");
    expect(bootstrap).toContain("GCP_DEPLOYER_SERVICE_ACCOUNT");
    expect(bootstrap).toContain("roles/iam.workloadIdentityUser");
    expect(bootstrap).toContain("Do not create or store a long-lived service account JSON key.");
  });

  it("deployment docs cover the required rollout sequence and secret containers", () => {
    const deployment = readFileSync("docs/deployment.md", "utf8");
    for (const phrase of [
      "hosting GCP project",
      "separate Gemini API key project",
      "Slack App ID, Team ID, and Signing Secret",
      "Bot Token",
      "Secret Manager versions",
      "slack-emoji-bot-slack-signing-secret",
      "slack-emoji-bot-slack-bot-token",
      "slack-emoji-bot-gemini-api-key",
      "Slack Event Subscription URL verification",
      "DRY_RUN=true",
      "DRY_RUN=false"
    ]) {
      expect(deployment).toContain(phrase);
    }
  });

  it("Terraform declares required low-cost serverless infrastructure", () => {
    const terraform = readFileSync("infra/terraform/main.tf", "utf8");
    for (const phrase of [
      "run.googleapis.com",
      "cloudtasks.googleapis.com",
      "firestore.googleapis.com",
      "secretmanager.googleapis.com",
      "artifactregistry.googleapis.com",
      "iamcredentials.googleapis.com",
      "sts.googleapis.com",
      "${local.service_prefix}-slack-signing-secret",
      "${local.service_prefix}-slack-bot-token",
      "${local.service_prefix}-gemini-api-key",
      "google_cloud_run_v2_service\" \"receiver\"",
      "google_cloud_run_v2_service\" \"worker\"",
      "google_cloud_tasks_queue\" \"queue\"",
      "google_firestore_database\" \"database\"",
      "google_firestore_field\" \"process_expires_at\"",
      "roles/cloudtasks.enqueuer",
      "roles/datastore.user",
      "roles/run.invoker",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "name  = \"NODE_ENV\"",
      "value = \"production\"",
      "min_instance_count = 0",
      "max_instance_count = 2"
    ]) {
      expect(terraform).toContain(phrase);
    }
    expect(terraform).not.toContain("cloudbuild.googleapis.com");
    expect(terraform).not.toContain("secret_data");
  });
});

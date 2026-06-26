import { describe, expect, it } from "vitest";
import { loadReceiverEnv } from "../../src/config/receiver-env.js";
import { parseTargetChannelSet, parseTargetUserSet } from "../../src/config/target-channels.js";
import { loadWorkerEnv } from "../../src/config/worker-env.js";

const receiverEnv = {
  NODE_ENV: "production",
  SLACK_SIGNING_SECRET: "secret",
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1,C2",
  TARGET_USER_IDS: "U1,U2",
  GCP_PROJECT_ID: "project",
  WORKER_URL: "https://worker.example.com",
  TASK_INVOKER_SERVICE_ACCOUNT_EMAIL: "task@example.iam.gserviceaccount.com"
};

const workerEnv = {
  NODE_ENV: "production",
  SLACK_TEAM_ID: "T1",
  SLACK_APP_ID: "A1",
  TARGET_CHANNEL_IDS: "C1,C2",
  TARGET_USER_IDS: "U1,U2",
  SLACK_BOT_TOKEN: "test-slack-token",
  GEMINI_BACKEND: "vertex",
  GEMINI_PROJECT_ID: "project",
  GEMINI_UNPAID_TERMS_ACKNOWLEDGED: "true"
};

describe("environment config", () => {
  it("parses unique target channel IDs", () => {
    expect(parseTargetChannelSet(" C1 , C2 ")).toEqual(new Set(["C1", "C2"]));
    expect(parseTargetUserSet(" U1 , U2 ")).toEqual(new Set(["U1", "U2"]));
    expect(loadReceiverEnv(receiverEnv).targetChannelSet).toEqual(new Set(["C1", "C2"]));
    const parsedWorker = loadWorkerEnv(workerEnv);
    expect(parsedWorker.targetChannelSet).toEqual(new Set(["C1", "C2"]));
    expect(parsedWorker.targetUserSet).toEqual(new Set(["U1", "U2"]));
    expect(parsedWorker.EMOJI_CONFIG_PATH).toBe("/app/config/emoji.default.yaml");
    expect(parsedWorker.GEMINI_BACKEND).toBe("vertex");
    expect(parsedWorker.GEMINI_LOCATION).toBe("global");
    expect(parsedWorker.LOG_LEVEL).toBe("info");
    expect(loadReceiverEnv({ ...receiverEnv, LOG_LEVEL: "debug" }).LOG_LEVEL).toBe("debug");
  });

  it("requires the correct Gemini credentials for each backend", () => {
    expect(() => loadWorkerEnv({ ...workerEnv, GEMINI_BACKEND: "developer", GEMINI_API_KEY: undefined })).toThrow(/GEMINI_API_KEY/u);
    expect(() => loadWorkerEnv({ ...workerEnv, GEMINI_PROJECT_ID: undefined })).toThrow(/GEMINI_PROJECT_ID/u);
    expect(loadWorkerEnv({ ...workerEnv, GEMINI_BACKEND: "developer", GEMINI_API_KEY: "test-gemini-key" }).GEMINI_BACKEND).toBe(
      "developer"
    );
  });

  it("rejects empty or duplicate target channel IDs", () => {
    expect(() => parseTargetChannelSet("C1,,C2")).toThrow(/empty/u);
    expect(() => parseTargetChannelSet("C1,C1")).toThrow(/duplicate/u);
    expect(() => parseTargetUserSet("U1,,U2")).toThrow(/empty/u);
    expect(() => parseTargetUserSet("U1,U1")).toThrow(/duplicate/u);
    expect(() => loadReceiverEnv({ ...receiverEnv, TARGET_CHANNEL_IDS: "C1,C1" })).toThrow(/duplicate/u);
    expect(() => loadWorkerEnv({ ...workerEnv, TARGET_USER_IDS: "U1," })).toThrow(/empty/u);
  });

  it("requires Gemini unpaid terms acknowledgement in production", () => {
    expect(() => loadWorkerEnv({ ...workerEnv, GEMINI_UNPAID_TERMS_ACKNOWLEDGED: "false" })).toThrow(/GEMINI_UNPAID_TERMS_ACKNOWLEDGED/u);
    expect(loadWorkerEnv({ ...workerEnv, NODE_ENV: "development", GEMINI_UNPAID_TERMS_ACKNOWLEDGED: "false" }).GEMINI_UNPAID_TERMS_ACKNOWLEDGED).toBe(false);
  });

  it("requires explicit NODE_ENV", () => {
    const receiverWithoutNodeEnv = { ...receiverEnv, NODE_ENV: undefined };
    const workerWithoutNodeEnv = { ...workerEnv, NODE_ENV: undefined };
    expect(() => loadReceiverEnv(receiverWithoutNodeEnv)).toThrow();
    expect(() => loadWorkerEnv(workerWithoutNodeEnv)).toThrow();
  });

  it("rejects unsupported log levels at startup", () => {
    expect(() => loadReceiverEnv({ ...receiverEnv, LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/u);
    expect(() => loadWorkerEnv({ ...workerEnv, LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/u);
  });

  it("lists configuration errors without echoing secret values", () => {
    expect(() =>
      loadReceiverEnv({
        ...receiverEnv,
        NODE_ENV: undefined,
        SLACK_SIGNING_SECRET: "super-secret-signing-value",
        WORKER_URL: "not-url",
        MAX_ANALYSIS_TEXT_CHARS: "10"
      })
    ).toThrow(/NODE_ENV:|WORKER_URL:|MAX_ANALYSIS_TEXT_CHARS:/u);
    expect(() =>
      loadReceiverEnv({
        ...receiverEnv,
        NODE_ENV: undefined,
        SLACK_SIGNING_SECRET: "super-secret-signing-value",
        WORKER_URL: "not-url",
        MAX_ANALYSIS_TEXT_CHARS: "10"
      })
    ).toThrow(/Invalid receiver environment/u);

    try {
      loadReceiverEnv({
        ...receiverEnv,
        NODE_ENV: undefined,
        SLACK_SIGNING_SECRET: "super-secret-signing-value",
        WORKER_URL: "not-url",
        MAX_ANALYSIS_TEXT_CHARS: "10"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("super-secret-signing-value");
    }

    expect(() => loadWorkerEnv({ ...workerEnv, GEMINI_UNPAID_TERMS_ACKNOWLEDGED: "false" })).toThrow(
      /Invalid worker environment: GEMINI_UNPAID_TERMS_ACKNOWLEDGED/u
    );
  });
});

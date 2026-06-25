import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/domain/**/*.ts", "src/application/**/*.ts", "src/shared/**/*.ts", "src/config/emoji-config.ts"],
      exclude: [
        "src/application/ports/**/*.ts",
        "src/domain/errors.ts",
        "src/domain/process-state.ts",
        "src/shared/clock.ts",
        "src/shared/logger.ts",
        "src/shared/result.ts"
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});

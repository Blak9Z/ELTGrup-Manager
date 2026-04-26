import { defineConfig } from "vitest/config";
import os from "node:os";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
    maxConcurrency: Math.min(6, Math.max(2, os.cpus().length - 1)),
    reporters: ["default", "html"],
  },
});

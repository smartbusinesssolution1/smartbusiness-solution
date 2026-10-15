import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Full HTTP stack against the disposable Postgres (its own database: platform_api_test).
    include: ["test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup/env.ts"],
    globalSetup: ["./test/setup/global-setup.ts"],
    // Files share one database and empty it between tests.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

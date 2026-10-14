import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Fast tests with no database: pure logic, PDF geometry, middleware.
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./test/setup/env.ts"],
        },
      },
      {
        test: {
          // Full HTTP stack against the disposable Postgres (pnpm test:db:up).
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./test/setup/env.ts"],
          globalSetup: ["./test/setup/global-setup.ts"],
          // Files share one database and truncate it between tests.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

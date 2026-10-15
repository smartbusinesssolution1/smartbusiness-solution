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
          // PDF rendering and image processing are CPU-heavy; with test files running in
          // parallel, a few take over the 5 s default without anything being wrong.
          testTimeout: 20_000,
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

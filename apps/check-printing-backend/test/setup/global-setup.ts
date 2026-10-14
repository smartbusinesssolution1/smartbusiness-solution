import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { testDatabaseUrl, TEST_STORAGE_PATH } from "./test-env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const databasePackageDir = path.resolve(here, "../../../../packages/database");

// Brings the test database to the current schema once per run, using the same
// migrations production uses, so a migration that cannot build a fresh database
// fails here first.
export default function setup() {
  const url = testDatabaseUrl();
  fs.rmSync(TEST_STORAGE_PATH, { recursive: true, force: true });

  try {
    execSync("npx prisma migrate deploy", {
      cwd: databasePackageDir,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (err) {
    const output = String((err as { stderr?: Buffer }).stderr ?? err);
    throw new Error(
      `Could not migrate the test database at ${new URL(url).host}.\n` +
        "Start it with: pnpm --filter @smartbusiness/check-printing-backend test:db:up\n\n" +
        output,
    );
  }

  return () => {
    fs.rmSync(TEST_STORAGE_PATH, { recursive: true, force: true });
  };
}

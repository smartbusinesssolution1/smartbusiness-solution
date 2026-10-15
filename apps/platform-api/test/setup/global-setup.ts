import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import { testDatabaseUrl } from "./test-env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const databasePackageDir = path.resolve(here, "../../../../packages/database");

// Creates (if needed) and migrates the test database once per run, with the same
// migrations production uses.
export default function setup() {
  const url = testDatabaseUrl();
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
}

// ═══════════════════════════════════════════════════════════════
// SEED GUARD
//
// The demo seed erases every table before inserting its data, so where it runs must be
// unmistakable. A DATABASE_URL copied from the wrong .env is enough to wipe a shared or
// production database; the delete commands themselves are fine, the target is the danger.
//
//   NODE_ENV=production    refused, always
//   local database         allowed (your machine, your data)
//   any other database     refused unless SEED_CONFIRM is exactly its host,
//                          like typing a repository's name to delete it
//
// Decided before any connection is opened. The password in the URL is never printed.
// ═══════════════════════════════════════════════════════════════

export interface SeedTarget {
  host: string;
  database: string;
}

export type SeedDecision =
  | { allowed: true; target: SeedTarget; reason: string }
  | { allowed: false; message: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// The seed: erases every table, so production is refused outright.
export function decideSeed(
  databaseUrl: string | undefined,
  env: { NODE_ENV?: string; SEED_CONFIRM?: string },
): SeedDecision {
  return decideDatabaseTarget(databaseUrl, env.NODE_ENV, env.SEED_CONFIRM, {
    action: "erase",
    confirmVariable: "SEED_CONFIRM",
    command: "pnpm db:seed",
    allowProduction: false,
  });
}

export interface TargetPolicy {
  action: string; // "erase", "add fingerprints to": worded into the refusal
  confirmVariable: string;
  command: string;
  allowProduction: boolean;
}

// The same rules for any script that writes to a database it was pointed at: local is free,
// anything else needs its exact host typed into confirmVariable, production only if allowed.
export function decideDatabaseTarget(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
  confirmation: string | undefined,
  policy: TargetPolicy,
): SeedDecision {
  if (!databaseUrl) {
    return { allowed: false, message: "DATABASE_URL is not set, so there is nothing to seed." };
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { allowed: false, message: "DATABASE_URL is not a valid URL." };
  }

  const target: SeedTarget = {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "(default)",
  };
  const where = `"${target.database}" on ${target.host}`;

  if (nodeEnv === "production" && !policy.allowProduction) {
    return {
      allowed: false,
      message: `Refusing to seed ${where}: NODE_ENV=production. The seed erases every table and is never run in production.`,
    };
  }

  if (LOCAL_HOSTS.has(target.host)) {
    return { allowed: true, target, reason: "local database" };
  }

  const { confirmVariable, command, action } = policy;
  const confirm = confirmation?.trim();
  if (!confirm) {
    return {
      allowed: false,
      message:
        `Refusing to ${action} ${where}: it is not a local database.\n` +
        `If you really mean to ${action} it, confirm with its host:\n` +
        `  ${confirmVariable}=${target.host} ${command}`,
    };
  }
  if (confirm !== target.host) {
    return {
      allowed: false,
      message:
        `Refusing to ${action} ${where}: ${confirmVariable} ("${confirm}") does not match its host.\n` +
        `  ${confirmVariable}=${target.host} ${command}`,
    };
  }

  return { allowed: true, target, reason: `confirmed with ${confirmVariable}` };
}

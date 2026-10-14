import pino from "pino";
import { Prisma } from "@smartbusiness/database";
import { server } from "../../config/index.js";

// Field names whose values must never reach a log line, wherever they appear.
const SENSITIVE_KEYS = [
  "accountNumber",
  "routingNumber",
  "accountNumberEncrypted",
  "routingNumberEncrypted",
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "signatureImage",
];

export const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

function isPrismaError(err: unknown): err is Error {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError
  );
}

/**
 * Prisma error messages embed the query arguments (payee names, amounts, encrypted
 * bank fields), and the stack's first line repeats the message. Keep only the code,
 * the metadata (column names) and the call frames.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (isPrismaError(err)) {
    const known = err instanceof Prisma.PrismaClientKnownRequestError ? err : null;
    return {
      type: err.name,
      code: known?.code,
      meta: known?.meta,
      stack: err.stack
        ?.split("\n")
        .filter((line) => line.trimStart().startsWith("at "))
        .join("\n"),
    };
  }
  return pino.stdSerializers.err(err as Error) as unknown as Record<string, unknown>;
}

export const logger = pino({
  name: "check-printing-api",
  level: server.isTest ? "silent" : server.isDev ? "debug" : "info",
  ...(server.isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: {
    err: serializeError,
  },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
});

export type Logger = pino.Logger;

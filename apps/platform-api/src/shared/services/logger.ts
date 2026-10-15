import pino from "pino";
import { server } from "../../config/index.js";

export const logger = pino({
  name: "platform-api",
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
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      // Defense in depth: request bodies are not logged, but these must never appear anywhere.
      ...["password", "newPassword", "token", "refreshToken", "passwordHash"].flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = pino.Logger;

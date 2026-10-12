import pino from "pino";
import { env } from "../../config/index.js";

export const logger = pino({
  name: "clockInClockOut-backend",

  level: env.server.isDev ? "debug" : "info",

  timestamp: pino.stdTimeFunctions.isoTime,

  formatters: {
    level: (label) => ({
      level: label,
    }),
  },

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "secret",
    ],
    censor: "[REDACTED]",
  },

  ...(env.server.isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});
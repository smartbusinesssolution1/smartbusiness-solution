import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import { logger } from "../shared/services/logger.js";
import { randomUUID } from "crypto";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9\-_.~]{1,128}$/;

export const requestLoggerMiddleware = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => {
    const incoming = req.headers["x-request-id"];
    return typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : randomUUID();
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse, _responseTime: number) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  customProps: (req: IncomingMessage) => ({
    ip: req.socket.remoteAddress,
  }),
  serializers: {
    req(req: Record<string, unknown>) {
      return {
        method: req.method,
        url: req.url,
        query: req.query,
      };
    },
    res(res: Record<string, unknown>) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

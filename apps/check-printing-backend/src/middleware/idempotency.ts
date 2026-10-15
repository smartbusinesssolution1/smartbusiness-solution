import type { Request, Response, NextFunction } from "express";
import { prisma, Prisma } from "@smartbusiness/database";
import { AppError } from "../shared/errors/index.js";
import { logger } from "../shared/services/logger.js";

// ═══════════════════════════════════════════════════════════════
// IDEMPOTENCY MIDDLEWARE
//
// PURPOSE:
// A client that retries a request (a double-click, a timeout, a
// flaky network) must not create a second check or print a check
// twice. The client sends a UUID in the `Idempotency-Key` header;
// every request with the same key gets the same outcome.
//
// HOW IT WORKS (reserve first, then execute):
//
// 1. Before the handler runs, insert a reservation row for
//    (key, user). The unique index makes this atomic: of two
//    identical requests arriving together, exactly one inserts
//    the row and runs. Storing the record only after the handler
//    finished (the earlier design) let both run.
//
// 2. A request whose key is already reserved:
//    - completed, same method and path → replay the stored response
//    - completed, different endpoint   → 422 (key reused by mistake)
//    - still running                   → 409, retry shortly
//    - running for longer than STALE_RESERVATION_MS → the first
//      request died (crash, deploy); take the reservation over.
//
// 3. When the handler answers 2xx, the response is stored on the
//    reservation. Any other outcome deletes the reservation so the
//    client can fix the request and retry with the same key.
//
// Records expire after 24 hours.
//
// WHY POSTGRES, NOT REDIS?
// The reservation lives next to the data it protects; for a
// check-printing workload (hundreds of requests a day per tenant)
// the extra row is negligible.
//
// The header is optional: without it the request runs normally.
// ═══════════════════════════════════════════════════════════════

const IDEMPOTENCY_TTL_HOURS = 24;
const STALE_RESERVATION_MS = 2 * 60 * 1000;
const MAX_KEY_LENGTH = 255;

// statusCode of a reservation whose request is still running.
const IN_PROGRESS = 0;

type IdempotencyRecord = Prisma.IdempotencyRecordGetPayload<object>;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function reserve(key: string, userId: string, req: Request): Promise<boolean> {
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        userId,
        method: req.method,
        path: req.originalUrl.slice(0, 500),
        statusCode: IN_PROGRESS,
        responseBody: {},
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

// Deletes `existing` only if it is still the same row (no one else took it over).
async function discard(existing: IdempotencyRecord): Promise<void> {
  await prisma.idempotencyRecord.deleteMany({
    where: { id: existing.id, statusCode: existing.statusCode, createdAt: existing.createdAt },
  });
}

export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["idempotency-key"];
    const userId = req.user?.userId;

    if (key === undefined || !userId) {
      return next();
    }
    if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new AppError(
        `Idempotency-Key must be a single value of 1–${MAX_KEY_LENGTH} characters.`,
        400,
        "INVALID_IDEMPOTENCY_KEY",
      );
    }

    // Two attempts: the second covers a reservation we just cleared (expired or stale).
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await reserve(key, userId, req)) {
        captureOutcome(req, res, key, userId);
        return next();
      }

      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key_userId: { key, userId } },
      });
      if (!existing) continue; // Deleted between our insert and read; try again.

      const expired = existing.expiresAt < new Date();
      const stale =
        existing.statusCode === IN_PROGRESS &&
        Date.now() - existing.createdAt.getTime() > STALE_RESERVATION_MS;
      if (expired || stale) {
        await discard(existing);
        continue;
      }

      if (existing.method !== req.method || existing.path !== req.originalUrl.slice(0, 500)) {
        throw new AppError(
          "This Idempotency-Key was already used for a different request. Generate a new key for each new action.",
          422,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }

      if (existing.statusCode === IN_PROGRESS) {
        res.setHeader("Retry-After", "2");
        throw new AppError(
          "An identical request is still being processed. Wait a moment and retry.",
          409,
          "IDEMPOTENCY_IN_PROGRESS",
        );
      }

      res.setHeader("Idempotent-Replayed", "true");
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    throw new AppError(
      "An identical request is being processed. Wait a moment and retry.",
      409,
      "IDEMPOTENCY_IN_PROGRESS",
    );
  };
}

// Stores a 2xx JSON response on the reservation; releases it on any other outcome.
function captureOutcome(req: Request, res: Response, key: string, userId: string): void {
  let settled = false;
  const where = { key_userId: { key, userId } };

  const release = () =>
    prisma.idempotencyRecord
      .deleteMany({ where: { key, userId, statusCode: IN_PROGRESS } })
      .catch((err: unknown) => {
        logger.error({ err, path: req.originalUrl }, "Failed to release idempotency reservation");
      });

  // Both outcomes are written BEFORE the response leaves the server: a client that
  // retries the instant it gets an answer must find either the stored response
  // (success) or a free key (failure), never a reservation that is still "in progress".
  const originalJson = res.json.bind(res);
  res.json = function captureResponse(body: unknown) {
    settled = true;
    const succeeded = res.statusCode >= 200 && res.statusCode < 300;
    const write = succeeded
      ? prisma.idempotencyRecord
          .update({
            where,
            data: { statusCode: res.statusCode, responseBody: (body ?? {}) as Prisma.InputJsonValue },
          })
          .catch((err: unknown) => {
            logger.error({ err, path: req.originalUrl }, "Failed to store idempotency response");
          })
      : release();
    void write.finally(() => originalJson(body));
    return res;
  } as typeof res.json;

  // Fallback for an answer that was not sent through res.json (e.g. a raw PDF error).
  // Only after a response was sent: if the client disconnects mid-request the handler
  // is still running, and releasing then would let a retry run it a second time.
  // A request that dies without answering leaves a reservation that goes stale.
  res.on("finish", () => {
    if (!settled) {
      settled = true;
      void release();
    }
  });
}

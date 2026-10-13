import type { Request, Response, NextFunction } from "express";
import { prisma, Prisma } from "@smartbusiness/database";
import { ConflictError } from "../shared/errors/index.js";
import { logger } from "../shared/services/logger.js";

// ═══════════════════════════════════════════════════════════════
// IDEMPOTENCY MIDDLEWARE
//
// PURPOSE:
// Prevent duplicate processing of non-idempotent operations
// (POST requests that create financial resources).
//
// HOW IT WORKS:
//
// 1. Client generates a UUID and sends it as the
//    `Idempotency-Key` header with the POST request.
//
// 2. This middleware checks the database for an existing record
//    with that key (scoped to the user).
//
// 3. If found and not expired: return the stored response
//    immediately. The downstream handler never executes.
//    This is what makes the operation idempotent — calling it
//    twice returns the same result without side effects.
//
// 4. If not found: let the request proceed normally. After the
//    handler calls res.json(), we intercept it and store the
//    response body + status code alongside the key.
//
// 5. Records expire after 24 hours. A cleanup job should
//    periodically delete expired records.
//
// WHY NOT REDIS?
// Redis would be faster for lookups, but it cannot participate
// in the same database transaction as the resource creation.
// With PostgreSQL, we get transactional consistency: if the
// check creation fails and rolls back, the idempotency record
// also rolls back. With Redis, we'd have a "phantom" key that
// prevents retries.
//
// For a check-printing system with hundreds (not millions) of
// requests per day, PostgreSQL is more than fast enough.
//
// USAGE:
//   router.post("/", idempotency(), validate(schema), controller.create);
//
// The middleware is optional — if the client doesn't send the
// header, the request proceeds normally (no idempotency).
// This makes the API backwards-compatible.
// ═══════════════════════════════════════════════════════════════

const IDEMPOTENCY_TTL_HOURS = 24;

export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["idempotency-key"];

    if (!key || typeof key !== "string") {
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) {
      return next();
    }

    try {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key_userId: { key, userId } },
      });

      if (existing) {
        if (existing.expiresAt < new Date()) {
          await prisma.idempotencyRecord.delete({
            where: { id: existing.id },
          });
        } else {
          res
            .status(existing.statusCode)
            .json(existing.responseBody);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, "Idempotency lookup failed, proceeding without");
      return next();
    }

    // ─── Intercept res.json() to capture the response ───────
    //
    // This is the key technique: we wrap the original res.json()
    // method. When the downstream handler calls res.json(data),
    // our wrapper runs first, stores the idempotency record,
    // then calls the original to send the response.
    //
    // This pattern is used by Stripe, Square, and other payment
    // APIs that implement idempotency.
    // ─────────────────────────────────────────────────────────

    const originalJson = res.json.bind(res);

    res.json = function captureResponse(body: any) {
      const statusCode = res.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

        prisma.idempotencyRecord
          .create({
            data: {
              key,
              userId,
              method: req.method,
              path: req.originalUrl,
              statusCode,
              responseBody: body as Prisma.InputJsonValue,
              expiresAt,
            },
          })
          .catch((err: unknown) => {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002"
            ) {
              logger.warn({ key }, "Idempotency key race — duplicate insert ignored");
            } else {
              logger.error({ err, key }, "Failed to store idempotency record");
            }
          });
      }

      return originalJson(body);
    } as typeof res.json;

    next();
  };
}

import type { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = (req as unknown as Record<string, unknown>).id as string;
  res.setHeader("X-Request-Id", id);
  next();
}

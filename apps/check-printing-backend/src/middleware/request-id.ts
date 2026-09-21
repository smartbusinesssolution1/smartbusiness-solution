import { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req as any).id as string;
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

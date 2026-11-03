import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { accessToken } from "../../config/index.js";

export type SuperAdminRole = "SUPER_ADMIN" | "DEV_SUPER_ADMIN";

export interface SuperAdminTokenPayload {
  adminId: string;
  email: string;
  name: string;
  role: SuperAdminRole;
  type: "SUPER_ADMIN_SESSION";
}

const SUPER_ADMIN_TOKEN_TYPE = "SUPER_ADMIN_SESSION";
const ALGORITHM = "HS256";

export function generateSuperAdminToken(
  payload: Omit<SuperAdminTokenPayload, "type">,
  expiresIn: string = "8h",
): string {
  const fullPayload: SuperAdminTokenPayload = {
    ...payload,
    type: SUPER_ADMIN_TOKEN_TYPE,
  };
  return jwt.sign(fullPayload, accessToken.secret, {
    algorithm: ALGORITHM,
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  const decoded = jwt.verify(token, accessToken.secret, { algorithms: [ALGORITHM] }) as SuperAdminTokenPayload;
  if (!decoded || decoded.type !== SUPER_ADMIN_TOKEN_TYPE) {
    throw new Error("Invalid super admin token type.");
  }
  return decoded;
}

export function extractSuperAdminToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.headers["x-super-admin-token"] === "string") {
    return req.headers["x-super-admin-token"].trim();
  }
  if (req.cookies?.super_admin_token) {
    return req.cookies.super_admin_token;
  }
  return undefined;
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractSuperAdminToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: "Super Administrator authentication required. Please sign in.",
      });
      return;
    }

    const payload = verifySuperAdminToken(token);
    req.superAdmin = {
      adminId: payload.adminId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed.";
    res.status(401).json({
      success: false,
      error: `Invalid or expired Super Admin credentials: ${message}`,
    });
  }
}

export async function requireDevSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // First ensure super admin session is established
  if (!req.superAdmin) {
    await requireSuperAdmin(req, res, () => {});
    if (!req.superAdmin) return;
  }

  if (req.superAdmin.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({
      success: false,
      error: "Access denied. Telemetry and error logs are restricted to Dev Super Admin accounts.",
    });
    return;
  }

  next();
}

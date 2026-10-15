// Services
export { TokenService } from "./services/token.service.js";
export type { AccessTokenPayload } from "./services/token.service.js";
export { PasswordService } from "./services/password.service.js";
export { UserTokenService } from "./services/user-token.service.js";
export type { IssueTokenInput, TokenCheck, TokenProblem } from "./services/user-token.service.js";
export { generateOpaqueToken, hashOpaqueToken, looksLikeOpaqueToken } from "./utils/opaque-token.js";

// Middleware
export { createAuthMiddleware } from "./middleware/auth.middleware.js";
export { tenantMiddleware } from "./middleware/tenant.middleware.js";
export { requireProduct } from "./middleware/product.middleware.js";

// Errors
export { AppError, AuthError, ForbiddenError } from "./errors/index.js";

// Cookie utilities
export {
  getCookieBase,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "./utils/cookie.js";
export type { CookieConfig } from "./utils/cookie.js";

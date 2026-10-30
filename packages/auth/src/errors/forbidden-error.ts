import { AppError } from "./app-error.js";

export class ForbiddenError extends AppError {
  // code: a more specific reason the frontend can act on (e.g. PRODUCT_NOT_AVAILABLE);
  // the status stays 403, so callers that only look at the status are unaffected.
  constructor(message: string = "You do not have permission to perform this action", code: string = "FORBIDDEN") {
    super(message, 403, code);
  }
}

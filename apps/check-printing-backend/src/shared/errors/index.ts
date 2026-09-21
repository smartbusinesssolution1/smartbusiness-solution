// ReExport all error class
// src/shared/errors/index.ts

export { AppError } from "./app-error.js";
export { ValidationError } from "./validation-error.js";
export { AuthError } from "./auth-error.js";
export { ForbiddenError } from "./forbidden-error.js";
export { NotFoundError } from "./not-found-error.js";
export { ConflictError } from "./conflict-error.js";



/*
now we can in code do : 

import {
  AppError,
  ValidationError,
  AuthError,
} from "../../shared/errors";

*/
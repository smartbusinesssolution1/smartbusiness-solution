import { AppError } from "./app-error.js";

export class AuthError extends AppError {

    constructor(message: string = "Authentication Error") {
        super(message, 401, "UNAUTHORIZED");
    }
}
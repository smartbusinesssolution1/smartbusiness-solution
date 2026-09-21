import { AppError } from "./app-error.js";

export class ConflictError extends AppError {
    constructor(message: string = "Resource already exists") {
        super(message, 409, "CONFLICT");
    }
}
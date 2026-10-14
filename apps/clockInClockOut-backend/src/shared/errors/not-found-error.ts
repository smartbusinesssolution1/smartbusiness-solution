import { AppError } from "@smartbusiness/auth";

export class NotFoundError extends AppError {
  constructor(message: string = "resource") {
    super(`${message} not found`, 404, "NOT_FOUND");
  }
}

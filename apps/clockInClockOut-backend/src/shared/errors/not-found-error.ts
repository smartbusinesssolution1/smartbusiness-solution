import { AppError } from "@smartbusiness/auth";

export class NotFoundError extends AppError {
  constructor(message: string = "Resource") {
    const formattedMessage = message.toLowerCase().includes("not found")
      ? message
      : `${message} not found`;
    super(formattedMessage, 404, "NOT_FOUND");
  }
}

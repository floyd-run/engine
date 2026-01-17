import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class InputError extends AppError {
  constructor(public issues: ZodError["issues"]) {
    super("Invalid input", 422, "INVALID_INPUT");
  }
}

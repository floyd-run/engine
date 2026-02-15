import type { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Not found",
    public resourceType?: string,
    public resourceId?: string,
  ) {
    super(message, 404, "not_found");
  }
}

export class InputError extends AppError {
  constructor(public issues: ZodError["issues"]) {
    super("Invalid input", 422, "invalid_input");
  }
}

export class ConflictError extends AppError {
  constructor(
    public reasonCode: string,
    public details?: Record<string, unknown>,
  ) {
    super("Conflict", 409, reasonCode);
  }
}

import { NextResponse } from "next/server";

/**
 * Standardized API error response
 */
export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

/**
 * Standardized API success response wrapper
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number,
  details?: string,
  code?: string
): NextResponse<ApiError> {
  const body: ApiError = { error: message };
  if (details) body.details = details;
  if (code) body.code = code;

  return NextResponse.json(body, { status });
}

/**
 * Create a 400 Bad Request response
 */
export function badRequest(message: string, details?: string): NextResponse<ApiError> {
  return errorResponse(message, 400, details, "BAD_REQUEST");
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(message = "Unauthorized"): NextResponse<ApiError> {
  return errorResponse(message, 401, undefined, "UNAUTHORIZED");
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(message = "Forbidden"): NextResponse<ApiError> {
  return errorResponse(message, 403, undefined, "FORBIDDEN");
}

/**
 * Create a 404 Not Found response
 */
export function notFound(resource: string): NextResponse<ApiError> {
  return errorResponse(`${resource} not found`, 404, undefined, "NOT_FOUND");
}

/**
 * Create a 500 Internal Server Error response
 */
export function serverError(
  message = "Internal server error",
  error?: unknown
): NextResponse<ApiError> {
  const details = error instanceof Error ? error.message : undefined;
  return errorResponse(message, 500, details, "INTERNAL_ERROR");
}

/**
 * Create a successful JSON response
 */
export function success<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Create a 201 Created response
 */
export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Create a 204 No Content response
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Handle common API errors and return appropriate response
 */
export function handleApiError(error: unknown, context: string): NextResponse<ApiError> {
  console.error(`API Error (${context}):`, error);

  if (error instanceof Error) {
    // Check for Prisma-specific errors
    const prismaError = error as { code?: string; meta?: { cause?: string } };

    // Handle Prisma error codes
    if (prismaError.code === "P2025") {
      // Record not found (for update/delete operations)
      return notFound(context);
    }
    if (prismaError.code === "P2002") {
      // Unique constraint violation
      return badRequest("Resource already exists", error.message);
    }
    if (prismaError.code === "P2003") {
      // Foreign key constraint failed
      return badRequest("Referenced resource not found", error.message);
    }

    // Check for generic "not found" in message (but not for create operations)
    if (error.message.includes("Record to update not found") ||
        error.message.includes("Record to delete not found")) {
      return notFound(context);
    }
    if (error.message.includes("unique constraint")) {
      return badRequest("Resource already exists", error.message);
    }
  }

  // Return server error with full details for debugging
  return serverError(`Failed to ${context}`, error);
}

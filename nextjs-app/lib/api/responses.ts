/**
 * Standardized API Response Helpers
 *
 * All API routes should use these helpers for consistent response format:
 *
 * Success: { success: true, data: T }
 * Error:   { success: false, error: string, details?: unknown }
 */

import { NextResponse } from 'next/server';

/**
 * Standard success response
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Standard error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
) {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  notFound: (resource: string = 'Resource') =>
    errorResponse(`${resource} not found`, 404),

  badRequest: (message: string, details?: unknown) =>
    errorResponse(message, 400, details),

  validationError: (errors: unknown[]) =>
    errorResponse(
      errors.length === 1 && typeof errors[0] === 'object' && errors[0] !== null && 'message' in errors[0]
        ? (errors[0] as { message: string }).message
        : 'Validation failed',
      400,
      errors.length > 1 ? errors : undefined
    ),

  unauthorized: (message: string = 'Unauthorized') =>
    errorResponse(message, 401),

  forbidden: (message: string = 'Forbidden') =>
    errorResponse(message, 403),

  internal: (message: string = 'Internal server error', details?: unknown) =>
    errorResponse(message, 500, details),
};

/**
 * Wrap async route handler with standardized error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  errorMessage: string = 'An error occurred'
) {
  return async () => {
    try {
      return await handler();
    } catch (error) {
      console.error(errorMessage, error);
      return ApiErrors.internal(
        errorMessage,
        error instanceof Error ? error.message : undefined
      );
    }
  };
}

/**
 * Error response formatting for validation errors
 * Ensures consistent error response structure across all validation failures
 */

import { ValidationError } from '../types/validation-errors.js';

/**
 * Formatted error response structure
 */
export interface ErrorResponse {
  error: {
    type: string;
    message: string;
    source: string;
  };
  requestId: string;
}

/**
 * Format a validation error into a standardized error response
 * @param validationError The ValidationError to format
 * @param requestId The request ID to include in response
 * @returns Formatted error response
 */
export function formatValidationError(
  validationError: ValidationError,
  requestId: string
): ErrorResponse {
  return {
    error: {
      type: validationError.type,
      message: validationError.message,
      source: validationError.source
    },
    requestId
  };
}

/**
 * Type guard to check if an error is a ValidationError
 * @param error The error to check
 * @returns true if error is a ValidationError
 */
export function isValidationErrorResponse(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

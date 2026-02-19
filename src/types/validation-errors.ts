/**
 * Validation error types and custom error class
 */

// Error type constants
export const VALIDATION_ERROR_TYPES = {
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  JSON_DEPTH_EXCEEDED: 'json_depth_exceeded',
  UNKNOWN_MODEL: 'unknown_model',
  INVALID_MODEL_FIELD: 'invalid_model_field'
} as const;

export type ValidationErrorType = (typeof VALIDATION_ERROR_TYPES)[keyof typeof VALIDATION_ERROR_TYPES];

/**
 * Custom validation error class
 * Extends Error to support type and source identification
 */
export class ValidationError extends Error {
  constructor(
    public readonly type: ValidationErrorType,
    message: string,
    public readonly source: string = 'adapter_error'
  ) {
    super(message);
    this.name = 'ValidationError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

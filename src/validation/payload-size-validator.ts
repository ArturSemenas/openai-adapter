/**
 * Payload size validation
 * Validates that request Content-Length does not exceed maximum allowed size
 */

import { ValidationError, VALIDATION_ERROR_TYPES } from '../types/validation-errors.js';

/**
 * Validate payload size from Content-Length header
 * Throws ValidationError if payload exceeds maximum allowed size
 * @param contentLength The Content-Length header value
 * @param maxSizeBytes The maximum allowed size in bytes
 * @param maxSizeMB The maximum allowed size in MB (for error message)
 * @throws ValidationError if payload exceeds limit
 */
export function validatePayloadSize(
  contentLength: string | undefined,
  maxSizeBytes: number,
  maxSizeMB: number
): void {
  // If no Content-Length header, let it through - Fastify will buffer and we validate on parse
  if (!contentLength) {
    return;
  }

  const sizeBytes = parseInt(contentLength, 10);

  // Check if parseInt succeeded
  if (Number.isNaN(sizeBytes)) {
    return;
  }

  // Validate against maximum size
  if (sizeBytes > maxSizeBytes) {
    throw new ValidationError(
      VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
      `Request payload exceeds maximum size of ${maxSizeMB}MB`
    );
  }
}

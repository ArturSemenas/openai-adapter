/**
 * JSON depth validation
 * Validates that JSON nesting depth does not exceed maximum allowed level
 */

import { ValidationError, VALIDATION_ERROR_TYPES } from '../types/validation-errors.js';

/**
 * Calculate the maximum nesting depth of a JSON object
 * Depth counting: primitives = 0, { prop: primitive } = 1, { prop: { nested: primitive } } = 2, etc.
 * @param obj The object to analyze
 * @returns The maximum nesting depth
 */
function calculateMaxDepth(obj: unknown): number {
  // Primitives have depth 0
  if (typeof obj !== 'object' || obj === null) {
    return 0;
  }

  // Objects and arrays have at least depth 1
  let maxChildDepth = 0;

  if (Array.isArray(obj)) {
    // For arrays, find the maximum depth of elements
    for (const item of obj) {
      maxChildDepth = Math.max(maxChildDepth, calculateMaxDepth(item));
    }
  } else {
    // For objects, find the maximum depth of property values
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as Record<string, unknown>)[key];
        maxChildDepth = Math.max(maxChildDepth, calculateMaxDepth(value));
      }
    }
  }

  // Return 1 + max depth of children (object/array containing depth N children = depth N+1)
  return 1 + maxChildDepth;
}

/**
 * Validate JSON nesting depth
 * Throws ValidationError if nesting depth exceeds maximum
 * @param obj The parsed JSON object to validate
 * @param maxDepth The maximum allowed nesting depth
 * @throws ValidationError if depth exceeds limit
 */
export function validateJsonDepth(obj: unknown, maxDepth: number): void {
  const actualDepth = calculateMaxDepth(obj);

  if (actualDepth > maxDepth) {
    throw new ValidationError(
      VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
      `JSON nesting depth exceeds maximum of ${maxDepth} levels`
    );
  }
}

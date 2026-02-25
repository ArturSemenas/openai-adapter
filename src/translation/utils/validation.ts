/**
 * Shared validation utilities for translation operations
 * Extracts common validation patterns following DRY principle
 */

/**
 * Known message roles in OpenAI APIs
 * Both Chat Completions and Response API use the same role values
 */
export const KNOWN_MESSAGE_ROLES = ['system', 'user', 'assistant', 'developer', 'tool'] as const;

/**
 * Type for valid message roles
 */
export type MessageRole = typeof KNOWN_MESSAGE_ROLES[number];

/**
 * Validation error result
 */
export interface ValidationError {
  isValid: false;
  error: string;
}

/**
 * Validation success result
 */
export interface ValidationSuccess {
  isValid: true;
}

/**
 * Validation result type
 */
export type ValidationResult = ValidationSuccess | ValidationError;

/**
 * Validate that a value is a non-null object
 * 
 * @param value - The value to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateIsObject(request);
 * if (!result.isValid) {
 *   return { success: false, error: result.error, unknownFields: [] };
 * }
 * ```
 */
export function validateIsObject(value: unknown): ValidationResult {
  if (typeof value !== 'object' || value === null) {
    return {
      isValid: false,
      error: 'Request must be a valid object'
    };
  }
  return { isValid: true };
}

/**
 * Validate that a model field is a non-empty string
 * 
 * @param model - The model field value to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateModel(request.model);
 * if (!result.isValid) {
 *   return { success: false, error: result.error, unknownFields: [] };
 * }
 * ```
 */
export function validateModel(model: unknown): ValidationResult {
  if (typeof model !== 'string' || model.trim().length === 0) {
    return {
      isValid: false,
      error: 'Model field is required and must be a non-empty string'
    };
  }
  return { isValid: true };
}

/**
 * Validate that a message role is one of the known roles
 * 
 * @param role - The role value to validate
 * @returns true if role is valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (!isValidMessageRole(message.role)) {
 *   return { success: false, error: `Invalid role: ${message.role}` };
 * }
 * ```
 */
export function isValidMessageRole(role: string): role is MessageRole {
  return KNOWN_MESSAGE_ROLES.includes(role as MessageRole);
}

/**
 * Validate a single message object structure
 * 
 * Checks that the message has:
 * - Valid object type
 * - String role field with known value
 * - String content field
 * 
 * @param msg - The message to validate
 * @param index - The message index (for error messages)
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * for (let i = 0; i < messages.length; i++) {
 *   const result = validateMessage(messages[i], i);
 *   if (!result.isValid) {
 *     return { success: false, error: result.error, unknownFields: [] };
 *   }
 * }
 * ```
 */
export function validateMessage(msg: unknown, index: number): ValidationResult {
  // Check if message is an object
  if (typeof msg !== 'object' || msg === null) {
    return {
      isValid: false,
      error: `Message at index ${index} is invalid`
    };
  }

  const message = msg as Record<string, unknown>;

  // Check if role and content fields exist
  if (!('role' in message) || !('content' in message)) {
    return {
      isValid: false,
      error: `Message at index ${index} is invalid: must have role and content fields`
    };
  }

  // Validate role is a string
  if (typeof message.role !== 'string') {
    return {
      isValid: false,
      error: `Message role must be a string, got ${typeof message.role} at index ${index}`
    };
  }

  // Validate role is a known value
  if (!isValidMessageRole(message.role)) {
    return {
      isValid: false,
      error: `Invalid role '${message.role}' at index ${index}. Must be one of: ${KNOWN_MESSAGE_ROLES.join(', ')}`
    };
  }

  // Validate content is a string
  if (typeof message.content !== 'string') {
    return {
      isValid: false,
      error: `Message content must be a string, got ${typeof message.content} at index ${index}`
    };
  }

  return { isValid: true };
}

/**
 * Validate an array of messages
 * 
 * Checks that:
 * - Value is an array
 * - Array is not empty
 * - Each message has valid structure
 * 
 * @param messages - The messages array to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateMessagesArray(request.messages);
 * if (!result.isValid) {
 *   return { success: false, error: result.error, unknownFields: [] };
 * }
 * ```
 */
export function validateMessagesArray(messages: unknown): ValidationResult {
  // Check if messages is an array
  if (!Array.isArray(messages)) {
    return {
      isValid: false,
      error: 'Messages array is required and must contain at least one message'
    };
  }

  // Check if array is non-empty
  if (messages.length === 0) {
    return {
      isValid: false,
      error: 'Messages array is required and must contain at least one message'
    };
  }

  // Validate each message
  for (let i = 0; i < messages.length; i++) {
    const result = validateMessage(messages[i], i);
    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}

/**
 * Check if a value is a non-empty string
 * 
 * @param value - The value to check
 * @returns true if value is a non-empty string
 * 
 * @example
 * ```typescript
 * if (isNonEmptyString(request.instructions)) {
 *   // Process instructions
 * }
 * ```
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a valid number
 * 
 * @param value - The value to check
 * @returns true if value is a number
 * 
 * @example
 * ```typescript
 * if (isNumber(request.temperature)) {
 *   translated.temperature = request.temperature;
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Check if a value is a boolean
 * 
 * @param value - The value to check
 * @returns true if value is a boolean
 * 
 * @example
 * ```typescript
 * if (isBoolean(request.stream)) {
 *   translated.stream = request.stream;
 * }
 * ```
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is a non-null object (not an array)
 * 
 * @param value - The value to check
 * @returns true if value is a plain object
 * 
 * @example
 * ```typescript
 * if (isPlainObject(request.metadata)) {
 *   translated.metadata = request.metadata;
 * }
 * ```
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

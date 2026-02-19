/**
 * Unknown fields handler utility
 * Identifies and passes through unknown fields for forward compatibility
 */

import type { UnknownFieldsResult } from '../types.js';

/**
 * Known Chat Completions API fields
 */
const KNOWN_CHAT_FIELDS = new Set([
  'model',
  'messages',
  'temperature',
  'max_tokens',
  'max_completion_tokens',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
  'n',
  'stream',
  'tools',
  'tool_choice',
  'response_format',
  'metadata',
  'stop',
  'logprobs',
  'top_logprobs'
]);

/**
 * Known Response API fields
 */
const KNOWN_RESPONSE_FIELDS = new Set([
  'model',
  'input',
  'instructions',
  'temperature',
  'max_output_tokens',
  'top_p',
  'stream',
  'tools',
  'tool_choice',
  'text',
  'metadata',
  'previous_response_id'
]);

/**
 * Fields that are explicitly NOT passed through (unsupported, dropped)
 * These are Chat fields that have no Response API equivalent
 */
const DROPPED_FIELDS = new Set([
  'frequency_penalty',
  'presence_penalty',
  'n',
  'stop',
  'logprobs',
  'top_logprobs'
]);

/**
 * Detect unknown fields in Chat Completions request
 * Unknown fields are passed through for forward compatibility
 * @param payload The Chat Completions request payload
 * @returns Object with unknown field names and cleaned payload
 */
export function detectUnknownChatFields(
  payload: Record<string, unknown>
): UnknownFieldsResult {
  const unknownFields: string[] = [];
  const cleanedPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!KNOWN_CHAT_FIELDS.has(key)) {
      // This is an unknown field - pass it through
      unknownFields.push(key);
    }
    cleanedPayload[key] = value;
  }

  return { unknownFields, cleanedPayload };
}

/**
 * Detect unknown fields in Response API request
 * @param payload The Response API request payload
 * @returns Object with unknown field names and cleaned payload
 */
export function detectUnknownResponseFields(
  payload: Record<string, unknown>
): UnknownFieldsResult {
  const unknownFields: string[] = [];
  const cleanedPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'text' && typeof value === 'object' && value !== null) {
      // Handle nested text object fields
      const textObj = value as Record<string, unknown>;
      const unknownTextFields = Object.keys(textObj).filter(
        (textKey) => !['format'].includes(textKey)
      );
      if (unknownTextFields.length > 0) {
        unknownTextFields.forEach((field) => {
          unknownFields.push(`text.${field}`);
        });
      }
    } else if (!KNOWN_RESPONSE_FIELDS.has(key)) {
      // This is an unknown field - pass it through
      unknownFields.push(key);
    }
    cleanedPayload[key] = value;
  }

  return { unknownFields, cleanedPayload };
}

/**
 * Check if a field should be dropped during translation
 * @param fieldName The field name to check
 * @returns true if field should be dropped (not translated, not passed through)
 */
export function isDroppedField(fieldName: string): boolean {
  return DROPPED_FIELDS.has(fieldName);
}

/**
 * Get list of all known Chat Completions fields
 */
export function getKnownChatFields(): string[] {
  return Array.from(KNOWN_CHAT_FIELDS);
}

/**
 * Get list of all known Response API fields
 */
export function getKnownResponseFields(): string[] {
  return Array.from(KNOWN_RESPONSE_FIELDS);
}

/**
 * Get list of dropped fields
 */
export function getDroppedFields(): string[] {
  return Array.from(DROPPED_FIELDS);
}

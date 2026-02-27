/**
 * Shared field mapping utilities for translation operations
 * Extracts common field mapping patterns following DRY principle
 */

import { isNumber, isBoolean, isPlainObject } from './validation.js';

/**
 * Map tools field from source to target request
 * 
 * Both Chat Completions and Response API use identical tools structure,
 * so this is a direct pass-through when the field exists and is an array.
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * 
 * @example
 * ```typescript
 * const chatRequest = { model: 'gpt-4', messages: [], tools: [...] };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapToolsField(chatRequest, responseRequest);
 * // responseRequest.tools now contains the tools array
 * ```
 */
export function mapToolsField(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  if (source.tools !== undefined && Array.isArray(source.tools)) {
    target.tools = source.tools;
  }
}

/**
 * Map tool_choice field from source to target request
 * 
 * Both Chat Completions and Response API use identical tool_choice structure,
 * which can be either a string or an object. This function handles both cases.
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * 
 * @example
 * ```typescript
 * const chatRequest = { model: 'gpt-4', messages: [], tool_choice: 'auto' };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapToolChoiceField(chatRequest, responseRequest);
 * // responseRequest.tool_choice now contains 'auto'
 * ```
 */
export function mapToolChoiceField(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  if (source.tool_choice !== undefined && source.tool_choice !== null) {
    if (typeof source.tool_choice === 'string') {
      target.tool_choice = source.tool_choice;
    } else if (isPlainObject(source.tool_choice)) {
      target.tool_choice = source.tool_choice;
    }
  }
}

/**
 * Map standard numeric parameters (temperature, top_p)
 * 
 * These parameters have the same name and meaning in both APIs,
 * so they are direct pass-throughs when present.
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * @param fieldName - The name of the field to map
 * 
 * @example
 * ```typescript
 * const chatRequest = { model: 'gpt-4', messages: [], temperature: 0.7 };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapNumericField(chatRequest, responseRequest, 'temperature');
 * // responseRequest.temperature now contains 0.7
 * ```
 */
export function mapNumericField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  fieldName: string
): void {
  if (isNumber(source[fieldName])) {
    target[fieldName] = source[fieldName];
  }
}

/**
 * Map boolean fields (stream)
 * 
 * Boolean fields like 'stream' have the same meaning in both APIs
 * and are passed through directly when present.
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * @param fieldName - The name of the field to map
 * 
 * @example
 * ```typescript
 * const chatRequest = { model: 'gpt-4', messages: [], stream: true };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapBooleanField(chatRequest, responseRequest, 'stream');
 * // responseRequest.stream now contains true
 * ```
 */
export function mapBooleanField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  fieldName: string
): void {
  if (isBoolean(source[fieldName])) {
    target[fieldName] = source[fieldName];
  }
}

/**
 * Map metadata field from source to target request
 * 
 * Both Chat Completions and Response API support metadata as a plain object
 * containing custom key-value pairs. This is a direct pass-through.
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * 
 * @example
 * ```typescript
 * const chatRequest = { 
 *   model: 'gpt-4', 
 *   messages: [], 
 *   metadata: { userId: '123', sessionId: 'abc' } 
 * };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapMetadataField(chatRequest, responseRequest);
 * // responseRequest.metadata now contains the metadata object
 * ```
 */
export function mapMetadataField(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  if (isPlainObject(source.metadata)) {
    target.metadata = source.metadata;
  }
}

/**
 * Map all standard fields that are common between APIs
 * 
 * This is a convenience function that maps all fields that have
 * identical names and structures in both Chat Completions and Response API:
 * - temperature
 * - top_p
 * - stream
 * - tools
 * - tool_choice
 * - metadata
 * 
 * @param source - The source request object
 * @param target - The target request object to modify
 * 
 * @example
 * ```typescript
 * const chatRequest = { 
 *   model: 'gpt-4', 
 *   messages: [],
 *   temperature: 0.7,
 *   stream: true,
 *   tools: [...]
 * };
 * const responseRequest = { model: 'gpt-4', input: [] };
 * mapCommonFields(chatRequest, responseRequest);
 * // All common fields are now mapped to responseRequest
 * ```
 */
export function mapCommonFields(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  // Map numeric parameters
  mapNumericField(source, target, 'temperature');
  mapNumericField(source, target, 'top_p');

  // Map boolean parameters
  mapBooleanField(source, target, 'stream');

  // Map tool-related fields
  mapToolsField(source, target);
  mapToolChoiceField(source, target);

  // Map metadata
  mapMetadataField(source, target);
}

/**
 * Pass through unknown fields for forward compatibility
 * 
 * Copies all unknown fields from the cleaned payload to the target request,
 * excluding fields that are explicitly dropped (not supported).
 * 
 * @param unknownFields - Array of unknown field names
 * @param cleanedPayload - The cleaned source payload
 * @param target - The target request object to modify
 * @param isDroppedField - Function to check if a field should be dropped
 * 
 * @example
 * ```typescript
 * const unknownFields = ['custom_field', 'future_feature'];
 * const cleanedPayload = { custom_field: 'value', future_feature: true };
 * const target = { model: 'gpt-4', input: [] };
 * 
 * passThrough UnknownFields(
 *   unknownFields, 
 *   cleanedPayload, 
 *   target,
 *   (field) => field === 'dropped_field'
 * );
 * // target now contains custom_field and future_feature
 * ```
 */
export function passThroughUnknownFields(
  unknownFields: string[],
  cleanedPayload: Record<string, unknown>,
  target: Record<string, unknown>,
  isDroppedField: (field: string) => boolean
): void {
  for (const field of unknownFields) {
    if (!isDroppedField(field)) {
      target[field] = cleanedPayload[field];
    }
  }
}

/**
 * Chat Completions → Response API request translation
 * Implements field mapping from Chat format to Response format
 * Reference: translation-mapping-reference.md
 */

import type { ResponseApiRequest } from '../types.js';
import type { ChatToResponseTranslationResult, ChatToResponseTranslationOptions } from './types.js';
import { detectUnknownChatFields, isDroppedField } from '../utils/unknown-fields.js';
import {
  validateIsObject,
  validateModel,
  validateMessagesArray
} from '../utils/validation.js';
import {
  mapCommonFields,
  passThroughUnknownFields
} from '../utils/field-mapping.js';

/**
 * Translate Chat Completions request to Response API format
 *
 * Field mappings:
 * - model → model (direct copy)
 * - messages[] → input (messages array passed directly per Response API spec)
 * - temperature → temperature (direct copy)
 * - max_tokens/max_completion_tokens → max_output_tokens
 * - top_p → top_p (direct copy)
 * - stream → stream (direct copy)
 * - tools → tools (direct copy)
 * - tool_choice → tool_choice (direct copy)
 * - response_format → text.format
 * - metadata → metadata (direct copy)
 * - frequency_penalty, presence_penalty, n → DROPPED
 * - unknown fields → PASSED THROUGH (forward compatibility)
 *
 * Note: Response API accepts the same messages array format as Chat Completions.
 * See https://developers.openai.com/api/docs/guides/conversation-state
 *
 * Multi-turn detection:
 * - Detects when messages array has >1 message
 * - Logs multi-turn conversations for monitoring
 * - Sets flags for downstream state management (Epic 4)
 *
 * @param request Chat Completions request
 * @param options Translation options including requestId
 * @returns TranslationResult with translated request or error details
 */
export function translateChatToResponse(
  request: unknown,
  _options: ChatToResponseTranslationOptions
): ChatToResponseTranslationResult {
  try {
    // Validate input is an object
    const objectValidation = validateIsObject(request);
    if (!objectValidation.isValid) {
      return {
        success: false,
        error: objectValidation.error,
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    const chatRequest = request as Record<string, unknown>;

    // Validate model field
    const modelValidation = validateModel(chatRequest.model);
    if (!modelValidation.isValid) {
      return {
        success: false,
        error: modelValidation.error,
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    const model = chatRequest.model as string;

    // Validate messages array
    const messagesValidation = validateMessagesArray(chatRequest.messages);
    if (!messagesValidation.isValid) {
      return {
        success: false,
        error: messagesValidation.error,
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    const messages = chatRequest.messages as Array<Record<string, unknown>>;

    // Detect multi-turn conversation
    const multi_turn_detected = messages.length > 1;

    // Detect unknown fields in the request
    const { unknownFields, cleanedPayload } = detectUnknownChatFields(
      chatRequest as Record<string, unknown>
    );

    // Build Response API request
    // Per Response API docs, input field accepts same messages array format as Chat Completions
    const responseRequest: ResponseApiRequest = {
      model,
      input: messages
    };

    // Map standard parameters that are common between APIs
    mapCommonFields(chatRequest, responseRequest);

    // Map max_tokens with fallback to max_completion_tokens
    const maxTokens =
      chatRequest.max_tokens ?? chatRequest.max_completion_tokens;
    if (typeof maxTokens === 'number') {
      responseRequest.max_output_tokens = maxTokens;
    }

    // Map response_format to text.format
    if (typeof chatRequest.response_format === 'object' && chatRequest.response_format !== null) {
      const responseFormat = chatRequest.response_format as Record<string, unknown>;
      if (Object.keys(responseFormat).length > 0) {
        const format = typeof responseFormat.type === 'string'
          ? responseFormat.type
          : 'json_object';
        responseRequest.text = { format };
      }
    }

    // Pass through unknown fields (for forward compatibility)
    passThroughUnknownFields(unknownFields, cleanedPayload, responseRequest, isDroppedField);

    return {
      success: true,
      translated: responseRequest,
      unknownFields,
      multi_turn_detected
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      unknownFields: [],
      multi_turn_detected: false
    };
  }
}

/**
 * Validate that a value is a valid Chat Completions request
 * @param request The value to check
 * @returns true if it appears to be a valid Chat request structure
 */
export function isChatCompletionsRequest(request: unknown): boolean {
  if (typeof request !== 'object' || request === null) {
    return false;
  }

  const req = request as Record<string, unknown>;

  // Must have model and messages
  if (typeof req.model !== 'string' || !Array.isArray(req.messages)) {
    return false;
  }

  // Messages must be non-empty
  if (req.messages.length === 0) {
    return false;
  }

  // Each message should have role and content
  return req.messages.every((msg: unknown) => {
    if (typeof msg !== 'object' || msg === null) {
      return false;
    }
    const message = msg as Record<string, unknown>;
    return (
      typeof message.role === 'string' &&
      typeof message.content === 'string'
    );
  });
}

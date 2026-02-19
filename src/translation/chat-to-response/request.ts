/**
 * Chat Completions → Response API request translation
 * Implements field mapping from Chat format to Response format
 * Reference: translation-mapping-reference.md
 */

import type { ResponseApiRequest } from '../types.js';
import type { ChatToResponseTranslationResult, ChatToResponseTranslationOptions } from './types.js';
import { detectUnknownChatFields, isDroppedField } from '../utils/unknown-fields.js';

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
    if (typeof request !== 'object' || request === null) {
      return {
        success: false,
        error: 'Request must be a valid object',
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    const chatRequest = request as Record<string, unknown>;

    // Extract model (required field)
    const model = chatRequest.model;
    if (typeof model !== 'string' || model.length === 0) {
      return {
        success: false,
        error: 'Model field is required and must be a non-empty string',
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    // Extract and validate messages array
    const messages = chatRequest.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        success: false,
        error: 'Messages array is required and must contain at least one message',
        unknownFields: [],
        multi_turn_detected: false
      };
    }

    // Validate each message has required structure
    const KNOWN_ROLES = ['system', 'user', 'assistant', 'developer', 'tool'] as const;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (typeof msg !== 'object' || msg === null) {
        return {
          success: false,
          error: `Message at index ${i} is invalid`,
          unknownFields: [],
          multi_turn_detected: false
        };
      }

      const message = msg as Record<string, unknown>;
      if (typeof message.role !== 'string') {
        return {
          success: false,
          error: `Message role must be a string, got ${typeof message.role} at index ${i}`,
          unknownFields: [],
          multi_turn_detected: false
        };
      }

      const role = message.role;
      if (!KNOWN_ROLES.includes(role as (typeof KNOWN_ROLES)[number])) {
        return {
          success: false,
          error: `Invalid role "${role}" at index ${i}. Must be one of: ${KNOWN_ROLES.join(', ')}`,
          unknownFields: [],
          multi_turn_detected: false
        };
      }

      if (typeof message.content !== 'string') {
        return {
          success: false,
          error: `Message content must be a string, got ${typeof message.content} at index ${i}`,
          unknownFields: [],
          multi_turn_detected: false
        };
      }
    }

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

    // Map standard parameters
    if (typeof chatRequest.temperature === 'number') {
      responseRequest.temperature = chatRequest.temperature;
    }

    // Map max_tokens with fallback to max_completion_tokens
    const maxTokens =
      chatRequest.max_tokens ?? chatRequest.max_completion_tokens;
    if (typeof maxTokens === 'number') {
      responseRequest.max_output_tokens = maxTokens;
    }

    if (typeof chatRequest.top_p === 'number') {
      responseRequest.top_p = chatRequest.top_p;
    }

    if (typeof chatRequest.stream === 'boolean') {
      responseRequest.stream = chatRequest.stream;
    }

    // Map tools and tool_choice
    if (
      chatRequest.tools !== undefined &&
      Array.isArray(chatRequest.tools)
    ) {
      responseRequest.tools = chatRequest.tools;
    }

    if (chatRequest.tool_choice !== undefined && chatRequest.tool_choice !== null) {
      if (typeof chatRequest.tool_choice === 'string') {
        responseRequest.tool_choice = chatRequest.tool_choice;
      } else if (typeof chatRequest.tool_choice === 'object' && !Array.isArray(chatRequest.tool_choice)) {
        responseRequest.tool_choice = chatRequest.tool_choice as Record<string, unknown>;
      }
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

    // Map metadata
    if (typeof chatRequest.metadata === 'object' && chatRequest.metadata !== null && !Array.isArray(chatRequest.metadata)) {
      responseRequest.metadata = chatRequest.metadata as Record<string, unknown>;
    }

    // Pass through unknown fields (for forward compatibility)
    for (const field of unknownFields) {
      if (!isDroppedField(field)) {
        (responseRequest as Record<string, unknown>)[field] = cleanedPayload[field];
      }
    }

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

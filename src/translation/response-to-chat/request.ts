/**
 * Response API → Chat Completions request translation
 * Implements field mapping from Response format to Chat format
 * Reference: translation-mapping-reference.md
 */

import type { ChatCompletionsRequest } from '../types.js';
import type { ResponseToChatTranslationResult, ResponseToChatTranslationOptions } from './types.js';
import { detectUnknownResponseFields, isDroppedField } from '../utils/unknown-fields.js';
import {
  validateIsObject,
  validateModel,
  validateMessage,
  isNonEmptyString
} from '../utils/validation.js';
import {
  mapCommonFields,
  passThroughUnknownFields
} from '../utils/field-mapping.js';

/**
 * Translate Response API request to Chat Completions format
 *
 * Field mappings:
 * - model → model (direct copy)
 * - input (string) → messages[] (single user message)
 * - input (array) → messages[] (direct copy, same format)
 * - instructions → prepend as system message in messages[]
 * - temperature → temperature (direct copy)
 * - max_output_tokens → max_tokens (field rename)
 * - top_p → top_p (direct copy)
 * - stream → stream (direct copy)
 * - tools → tools (direct copy)
 * - tool_choice → tool_choice (direct copy)
 * - text.format → response_format.type
 * - metadata → metadata (direct copy)
 * - thread_id → NOT MAPPED (PoC limitation: thread history retrieval out of scope)
 * - unknown fields → PASSED THROUGH (forward compatibility)
 *
 * Note: Response API and Chat Completions use the same messages array format.
 * See https://developers.openai.com/api/docs/guides/conversation-state
 *
 * PoC Scope Limitation:
 * - thread_id is preserved as an unknown field but not processed for thread history retrieval
 * - Future enhancement: Implement thread history fetching from upstream Response API
 *
 * @param request Response API request
 * @param options Translation options including requestId
 * @returns TranslationResult with translated request or error details
 */
export function translateResponseToChat(
  request: unknown,
  _options: ResponseToChatTranslationOptions
): ResponseToChatTranslationResult {
  try {
    // Validate input is an object
    const objectValidation = validateIsObject(request);
    if (!objectValidation.isValid) {
      return {
        success: false,
        error: objectValidation.error,
        unknownFields: []
      };
    }

    const responseRequest = request as Record<string, unknown>;

    // Validate model field
    const modelValidation = validateModel(responseRequest.model);
    if (!modelValidation.isValid) {
      return {
        success: false,
        error: modelValidation.error,
        unknownFields: []
      };
    }

    const model = responseRequest.model as string;

    // Extract and validate input field (required)
    const input = responseRequest.input;
    if (input === undefined || input === null) {
      return {
        success: false,
        error: 'Input field is required',
        unknownFields: []
      };
    }

    // Validate input type (must be string or array)
    if (typeof input !== 'string' && !Array.isArray(input)) {
      return {
        success: false,
        error: 'Input must be a string or messages array',
        unknownFields: []
      };
    }

    // Handle string input
    let messages: Array<Record<string, unknown>>;
    if (typeof input === 'string') {
      // Validate non-empty string
      if (input.length === 0) {
        return {
          success: false,
          error: 'Input string cannot be empty',
          unknownFields: []
        };
      }

      // Convert string to single user message
      messages = [
        {
          role: 'user',
          content: input
        }
      ];
    } else {
      // Handle messages array input
      if (input.length === 0) {
        return {
          success: false,
          error: 'Input messages array cannot be empty',
          unknownFields: []
        };
      }

      // Validate each message has required structure
      for (let i = 0; i < input.length; i++) {
        const messageValidation = validateMessage(input[i], i);
        if (!messageValidation.isValid) {
          return {
            success: false,
            error: messageValidation.error,
            unknownFields: []
          };
        }
      }

      // Pass through messages array directly (same format)
      messages = input as Array<Record<string, unknown>>;
    }

    // Prepend instructions as system message if present
    if (isNonEmptyString(responseRequest.instructions)) {
      messages = [
        {
          role: 'system',
          content: responseRequest.instructions
        },
        ...messages
      ];
    }

    // Detect unknown fields in the request
    const { unknownFields, cleanedPayload } = detectUnknownResponseFields(
      responseRequest as Record<string, unknown>
    );

    // Build Chat Completions request
    const chatRequest: ChatCompletionsRequest = {
      model,
      messages: messages as Array<{ role: string; content: string }>
    };

    // Map standard parameters that are common between APIs
    mapCommonFields(responseRequest, chatRequest);

    // Map max_output_tokens to max_tokens (field rename)
    if (typeof responseRequest.max_output_tokens === 'number') {
      chatRequest.max_tokens = responseRequest.max_output_tokens;
    }

    // Map text.format to response_format.type
    if (typeof responseRequest.text === 'object' && responseRequest.text !== null) {
      const textObj = responseRequest.text as Record<string, unknown>;
      if (typeof textObj.format === 'string') {
        chatRequest.response_format = {
          type: textObj.format
        };
      }
    }

    // Pass through unknown fields (for forward compatibility)
    passThroughUnknownFields(unknownFields, cleanedPayload, chatRequest, isDroppedField);

    return {
      success: true,
      translated: chatRequest,
      unknownFields
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      unknownFields: []
    };
  }
}

/**
 * Validate that a value is a valid Response API request
 * @param request The value to check
 * @returns true if it appears to be a valid Response API request structure
 */
export function isResponseApiRequest(request: unknown): boolean {
  if (typeof request !== 'object' || request === null) {
    return false;
  }

  const req = request as Record<string, unknown>;

  // Must have model field (non-empty string)
  if (typeof req.model !== 'string' || req.model.trim().length === 0) {
    return false;
  }

  // Must have input field (string or array)
  if (req.input === undefined || req.input === null) {
    return false;
  }

  if (typeof req.input !== 'string' && !Array.isArray(req.input)) {
    return false;
  }

  // If input is string, must be non-empty
  if (typeof req.input === 'string' && req.input.length === 0) {
    return false;
  }

  // If input is array, must be non-empty and contain valid messages
  if (Array.isArray(req.input)) {
    if (req.input.length === 0) {
      return false;
    }

    // Each message should have role and content
    return req.input.every((msg: unknown) => {
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

  return true;
}

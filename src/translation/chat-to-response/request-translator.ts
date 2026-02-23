/**
 * Chat→Response request translator implementation
 * Implements RequestTranslator interface
 */

import type { RequestTranslator, TranslationResult, TranslationOptions } from '../interfaces.js';
import type { ResponseApiRequest } from '../types.js';
import type { ChatToResponseTranslationResult, ChatToResponseTranslationOptions } from './types.js';
import { translateChatToResponse, isChatCompletionsRequest } from './request.js';

/**
 * Extended result with multi-turn detection
 * 
 * Adds Chat→Response specific metadata to the base TranslationResult.
 * The multi_turn_detected flag indicates when a conversation contains
 * multiple messages, which affects how the translation is performed.
 */
export interface ChatToResponseResult extends TranslationResult<ResponseApiRequest> {
  /** True if the chat request contains multiple messages (multi-turn conversation) */
  multi_turn_detected?: boolean;
}

/**
 * Chat Completions → Response API request translator
 * 
 * Implements the RequestTranslator interface for translating OpenAI Chat
 * Completions requests to OpenAI Response API format. This is a wrapper
 * around the existing translateChatToResponse function that provides
 * interface compliance for dependency injection (DIP).
 * 
 * Key features:
 * - Validates Chat Completions request format
 * - Translates to Response API format
 * - Detects multi-turn conversations
 * - Preserves unknown fields for forward compatibility
 * 
 * @example
 * ```typescript
 * const translator = new ChatToResponseRequestTranslator();
 * 
 * if (translator.isValidRequest(request)) {
 *   const result = translator.translateRequest(request, { 
 *     requestId: 'req-123' 
 *   });
 *   
 *   if (result.success) {
 *     console.log('Translated:', result.translated);
 *     if (result.multi_turn_detected) {
 *       console.log('Multi-turn conversation detected');
 *     }
 *   }
 * }
 * ```
 */
export class ChatToResponseRequestTranslator 
  implements RequestTranslator<ChatToResponseTranslationResult, ResponseApiRequest> {
  
  /**
   * Translate a Chat Completions request to Response API format
   * 
   * Delegates to the existing translateChatToResponse function and
   * adapts the result to match the RequestTranslator interface.
   * 
   * @param request - The Chat Completions request to translate
   * @param options - Translation options (requestId, strict mode)
   * @returns Translation result with Response API request or error
   */
  translateRequest(
    request: unknown,
    options: TranslationOptions
  ): ChatToResponseResult {
    const result = translateChatToResponse(
      request,
      options as ChatToResponseTranslationOptions
    ) as ChatToResponseTranslationResult;
    
    return {
      success: result.success,
      translated: result.translated,
      error: result.error,
      unknownFields: result.unknownFields,
      multi_turn_detected: result.multi_turn_detected
    };
  }

  /**
   * Validate that a request is a valid Chat Completions request
   * 
   * Checks if the request has the required structure for Chat Completions
   * format. Should be called before translateRequest to ensure safety.
   * 
   * @param request - The request to validate
   * @returns true if request is a valid Chat Completions request
   */
  isValidRequest(request: unknown): boolean {
    return isChatCompletionsRequest(request);
  }
}

/**
 * Factory function for creating ChatToResponseRequestTranslator instance
 * 
 * Provides a clean way to instantiate the translator without using 'new'.
 * Useful for dependency injection and testing scenarios.
 * 
 * @returns A new instance of ChatToResponseRequestTranslator
 * 
 * @example
 * ```typescript
 * const translator = createChatToResponseRequestTranslator();
 * const result = translator.translateRequest(request, { requestId: '123' });
 * ```
 */
export function createChatToResponseRequestTranslator(): ChatToResponseRequestTranslator {
  return new ChatToResponseRequestTranslator();
}

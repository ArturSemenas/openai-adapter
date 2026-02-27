/**
 * Response→Chat request translator implementation
 * Implements RequestTranslator interface
 */

import type { RequestTranslator, TranslationResult, TranslationOptions } from '../interfaces.js';
import type { ChatCompletionsRequest } from '../types.js';
import type { ResponseToChatTranslationResult, ResponseToChatTranslationOptions } from './types.js';
import { translateResponseToChat, isResponseApiRequest } from './request.js';

/**
 * Response API → Chat Completions request translator
 * 
 * Implements the RequestTranslator interface for translating OpenAI Response
 * API requests to OpenAI Chat Completions format. This is a wrapper around
 * the existing translateResponseToChat function that provides interface
 * compliance for dependency injection (DIP).
 * 
 * Key features:
 * - Validates Response API request format
 * - Translates to Chat Completions format
 * - Handles string and messages array input
 * - Prepends instructions as system message
 * - Preserves unknown fields for forward compatibility
 * 
 * PoC Scope Limitation:
 * - thread_id is preserved as an unknown field but not processed for thread history retrieval
 * - Future enhancement: Implement thread history fetching from upstream Response API
 * 
 * @example
 * ```typescript
 * const translator = new ResponseToChatRequestTranslator();
 * 
 * if (translator.isValidRequest(request)) {
 *   const result = translator.translateRequest(request, { 
 *     requestId: 'req-123' 
 *   });
 *   
 *   if (result.success) {
 *     console.log('Translated:', result.translated);
 *   }
 * }
 * ```
 */
export class ResponseToChatRequestTranslator 
  implements RequestTranslator<ResponseToChatTranslationResult, ChatCompletionsRequest> {
  
  /**
   * Translate a Response API request to Chat Completions format
   * 
   * Delegates to the existing translateResponseToChat function and
   * adapts the result to match the RequestTranslator interface.
   * 
   * @param request - The Response API request to translate
   * @param options - Translation options (requestId, strict mode)
   * @returns Translation result with Chat Completions request or error
   */
  translateRequest(
    request: unknown,
    options: TranslationOptions
  ): TranslationResult<ChatCompletionsRequest> {
    const result = translateResponseToChat(
      request,
      options as ResponseToChatTranslationOptions
    ) as ResponseToChatTranslationResult;
    
    return {
      success: result.success,
      translated: result.translated,
      error: result.error,
      unknownFields: result.unknownFields
    };
  }

  /**
   * Validate that a request is a valid Response API request
   * 
   * Checks if the request has the required structure for Response API
   * format. Should be called before translateRequest to ensure safety.
   * 
   * @param request - The request to validate
   * @returns true if request is a valid Response API request
   */
  isValidRequest(request: unknown): boolean {
    return isResponseApiRequest(request);
  }
}

/**
 * Factory function for creating ResponseToChatRequestTranslator instance
 * 
 * Provides a clean way to instantiate the translator without using 'new'.
 * Useful for dependency injection and testing scenarios.
 * 
 * @returns A new instance of ResponseToChatRequestTranslator
 * 
 * @example
 * ```typescript
 * const translator = createResponseToChatRequestTranslator();
 * const result = translator.translateRequest(request, { requestId: '123' });
 * ```
 */
export function createResponseToChatRequestTranslator(): ResponseToChatRequestTranslator {
  return new ResponseToChatRequestTranslator();
}

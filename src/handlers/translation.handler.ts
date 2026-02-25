/**
 * Translation handler - orchestrates translation operations
 * Depends on translator interfaces (DIP) and delegates logging to orchestrator (SRP)
 */

import type { FastifyInstance } from 'fastify';
import type { RequestTranslator } from '../translation/interfaces.js';
import type { ResponseApiRequest, ChatCompletionsRequest } from '../translation/types.js';
import { orchestrateRequestTranslation } from '../translation/utils/translation-orchestrator.js';
import { createChatToResponseRequestTranslator } from '../translation/chat-to-response/request-translator.js';
import { createResponseToChatRequestTranslator } from '../translation/response-to-chat/request-translator.js';

/**
 * Result of a translation handler operation
 * 
 * Simplified result type for HTTP handler layer. Contains only the
 * essential information needed to construct an HTTP response.
 */
export interface TranslationHandlerResult {
  /** Whether the translation succeeded */
  success: boolean;
  /** The translated request (if successful) */
  translated?: ResponseApiRequest | ChatCompletionsRequest | Record<string, unknown>;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Handles Chat Completions → Response API request translation
 * 
 * This handler follows Clean Architecture principles:
 * - Uses dependency injection for translator (DIP - Dependency Inversion Principle)
 * - Delegates logging to orchestrator (SRP - Single Responsibility Principle)
 * - Focuses only on HTTP request/response concerns (Interface Adapter layer)
 * 
 * The handler accepts an optional translator parameter for testing and flexibility,
 * but provides a default implementation for backward compatibility.
 * 
 * @param logger - Fastify logger instance for structured logging
 * @param requestId - Request identifier for correlation across logs
 * @param request - The Chat Completions request to translate
 * @param translator - Optional request translator (defaults to ChatToResponseRequestTranslator)
 * @returns TranslationHandlerResult with translated output or error
 * 
 * @example
 * ```typescript
 * // Using default translator
 * const result = handleChatToResponseTranslation(
 *   fastify.log,
 *   'req-123',
 *   chatRequest
 * );
 * 
 * // Using custom translator (for testing)
 * const mockTranslator = createMockTranslator();
 * const result = handleChatToResponseTranslation(
 *   fastify.log,
 *   'req-123',
 *   chatRequest,
 *   mockTranslator
 * );
 * ```
 */
export function handleChatToResponseTranslation(
  logger: FastifyInstance['log'],
  requestId: string,
  request: unknown,
  translator?: RequestTranslator
): TranslationHandlerResult {
  // Use default translator if not provided (backward compatibility)
  const actualTranslator = translator ?? createChatToResponseRequestTranslator();
  
  // Delegate to orchestrator (SRP - orchestrator handles logging)
  const result = orchestrateRequestTranslation(
    actualTranslator,
    request,
    {
      logger,
      requestId,
      direction: 'chat_to_response',
      strict: false
    }
  );

  // Return simplified result for HTTP layer
  return {
    success: result.success,
    translated: result.translated as ResponseApiRequest | Record<string, unknown> | undefined,
    error: result.error
  };
}

/**
 * Handles Response API → Chat Completions request translation
 * 
 * This handler follows Clean Architecture principles:
 * - Uses dependency injection for translator (DIP - Dependency Inversion Principle)
 * - Delegates logging to orchestrator (SRP - Single Responsibility Principle)
 * - Focuses only on HTTP request/response concerns (Interface Adapter layer)
 * 
 * The handler accepts an optional translator parameter for testing and flexibility,
 * but provides a default implementation for backward compatibility.
 * 
 * PoC Scope Limitation:
 * - thread_id is preserved as an unknown field but not processed for thread history retrieval
 * - Future enhancement: Implement thread history fetching from upstream Response API
 * 
 * @param logger - Fastify logger instance for structured logging
 * @param requestId - Request identifier for correlation across logs
 * @param request - The Response API request to translate
 * @param translator - Optional request translator (defaults to ResponseToChatRequestTranslator)
 * @returns TranslationHandlerResult with translated output or error
 * 
 * @example
 * ```typescript
 * // Using default translator
 * const result = handleResponseToChatTranslation(
 *   fastify.log,
 *   'req-123',
 *   responseRequest
 * );
 * 
 * // Using custom translator (for testing)
 * const mockTranslator = createMockTranslator();
 * const result = handleResponseToChatTranslation(
 *   fastify.log,
 *   'req-123',
 *   responseRequest,
 *   mockTranslator
 * );
 * ```
 */
export function handleResponseToChatTranslation(
  logger: FastifyInstance['log'],
  requestId: string,
  request: unknown,
  translator?: RequestTranslator
): TranslationHandlerResult {
  // Use default translator if not provided (backward compatibility)
  const actualTranslator = translator ?? createResponseToChatRequestTranslator();
  
  // Delegate to orchestrator (SRP - orchestrator handles logging)
  const result = orchestrateRequestTranslation(
    actualTranslator,
    request,
    {
      logger,
      requestId,
      direction: 'response_to_chat',
      strict: false
    }
  );

  // Return simplified result for HTTP layer
  return {
    success: result.success,
    translated: result.translated as ChatCompletionsRequest | Record<string, unknown> | undefined,
    error: result.error
  };
}

/**
 * Translation orchestrator - handles logging and context management
 * Separates logging concerns from handler orchestration (SRP)
 */

import type { FastifyInstance } from 'fastify';
import type { RequestTranslator, TranslationResult } from '../interfaces.js';
import type { TranslationDirection } from '../types.js';
import {
  logTranslation,
  logUnknownFields,
  createTranslationLogEntry
} from './translation-logger.js';

/**
 * Orchestration result with logging metadata
 * 
 * Extends TranslationResult with additional metadata specific to
 * Chat→Response translation (e.g., multi-turn detection).
 * 
 * @template T - The type of the translated output
 */
export interface OrchestrationResult<T = unknown> extends TranslationResult<T> {
  /** Indicates if multi-turn conversation was detected in the request */
  multi_turn_detected?: boolean;
}

/**
 * Translation orchestrator options
 * 
 * Configuration for orchestrating a translation operation, including
 * logging context and validation settings.
 */
export interface OrchestrationOptions {
  /** Fastify logger instance for structured logging */
  logger: FastifyInstance['log'];
  /** Request identifier for correlation across logs */
  requestId: string;
  /** Translation direction (e.g., 'chat_to_response', 'response_to_chat') */
  direction: TranslationDirection;
  /** If true, fail translation when unknown fields are detected */
  strict?: boolean;
}

/**
 * Orchestrate request translation with logging and error handling
 * 
 * This function separates logging concerns from the handler layer (SRP).
 * It coordinates the translation process, validates inputs, logs results,
 * and handles errors in a centralized way.
 * 
 * The orchestrator pattern allows handlers to focus on HTTP concerns while
 * delegating translation orchestration and logging to this utility.
 * 
 * @template TInput - The input request type (source format)
 * @template TOutput - The output request type (target format)
 * 
 * @param translator - The request translator to use (injected dependency)
 * @param request - The request to translate
 * @param options - Orchestration options including logger, requestId, and direction
 * @returns Orchestration result with translated request, error, or metadata
 * 
 * @example
 * ```typescript
 * const translator = createChatToResponseRequestTranslator();
 * const result = orchestrateRequestTranslation(
 *   translator,
 *   chatRequest,
 *   {
 *     logger: fastify.log,
 *     requestId: 'req-123',
 *     direction: 'chat_to_response',
 *     strict: false
 *   }
 * );
 * 
 * if (result.success) {
 *   // Use result.translated
 *   if (result.multi_turn_detected) {
 *     // Handle multi-turn conversation
 *   }
 * } else {
 *   // Handle result.error
 * }
 * ```
 */
export function orchestrateRequestTranslation<TInput, TOutput>(
  translator: RequestTranslator<TInput, TOutput>,
  request: TInput,
  options: OrchestrationOptions
): OrchestrationResult<TOutput> {
  const { logger, requestId, direction, strict } = options;

  // Validate request format
  if (!translator.isValidRequest(request)) {
    logger.warn({
      action: 'translation_invalid_request',
      requestId,
      direction,
      reason: 'Request does not match expected format'
    });

    return {
      success: false,
      error: 'Request does not match expected format',
      unknownFields: []
    };
  }

  try {
    // Perform translation
    const result = translator.translateRequest(request, { requestId, strict });

    // Log translation result
    const logEntry = createTranslationLogEntry(
      requestId,
      direction,
      'translate',
      result.unknownFields,
      result.success,
      result.error
    );
    logTranslation(logger, logEntry);

    // Log unknown fields if detected
    if (result.unknownFields.length > 0) {
      logUnknownFields(logger, requestId, direction, result.unknownFields);
    }

    // Log multi-turn detection if applicable
    const extendedResult = result as OrchestrationResult<TOutput>;
    if (extendedResult.multi_turn_detected) {
      logger.info({
        action: 'multi_turn_conversation_detected',
        requestId,
        direction,
        message: 'Multi-turn conversation detected; full message history passed through'
      });
    }

    return extendedResult;
  } catch (error) {
    logger.error({
      action: 'translation_error',
      requestId,
      direction,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during translation',
      unknownFields: []
    };
  }
}

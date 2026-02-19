/**
 * Translation handler - orchestrates translation operations
 * Integrates with the routing handler to perform Chat→Response and Response→Chat translations
 */

import type { FastifyInstance } from 'fastify';
import { translateChatToResponse, isChatCompletionsRequest } from '../translation/index.js';
import {
  logTranslation,
  logUnknownFields,
  createTranslationLogEntry
} from '../translation/utils/translation-logger.js';
import type { ResponseApiRequest } from '../translation/types.js';

/**
 * Result of a translation handler operation
 */
export interface TranslationHandlerResult {
  success: boolean;
  translated?: ResponseApiRequest | Record<string, unknown>;
  error?: string;
}

/**
 * Handles Chat Completions → Response API request translation
 * Orchestrates logging and field handling
 *
 * @param logger Fastify logger instance
 * @param requestId Request identifier for correlation
 * @param request The Chat Completions request to translate
 * @returns TranslationHandlerResult with translated output
 */
export function handleChatToResponseTranslation(
  logger: FastifyInstance['log'],
  requestId: string,
  request: unknown
): TranslationHandlerResult {
  // Validate that this is a Chat Completions request
  if (!isChatCompletionsRequest(request)) {
    logger.warn({
      action: 'translation_invalid_request',
      requestId,
      reason: 'Request does not match Chat Completions format'
    });

    return {
      success: false,
      error: 'Request does not match Chat Completions format'
    };
  }

  try {
    // Perform translation
    const translationResult = translateChatToResponse(request, { requestId });

    if (!translationResult.success) {
      // Translation failed
      const logEntry = createTranslationLogEntry(
        requestId,
        'chat_to_response',
        'translate',
        [],
        false,
        translationResult.error
      );

      logTranslation(logger, logEntry);

      return {
        success: false,
        error: translationResult.error
      };
    }

    // Log unknown fields if detected
    if (translationResult.unknownFields.length > 0) {
      logUnknownFields(
        logger,
        requestId,
        'chat_to_response',
        translationResult.unknownFields
      );
    }

    // Log translation completion with duration
    const logEntry = createTranslationLogEntry(
      requestId,
      'chat_to_response',
      'translate',
      translationResult.unknownFields,
      true
    );

    logTranslation(logger, logEntry);

    // Log multi-turn detection if applicable
    if (translationResult.multi_turn_detected) {
      logger.info({
        action: 'multi_turn_conversation_detected',
        requestId,
        direction: 'chat_to_response',
        message: 'Multi-turn conversation detected; full message history passed through (state management in Epic 4)'
      });
    }

    return {
      success: true,
      translated: translationResult.translated
    };
  } catch (error) {
    logger.error({
      action: 'translation_error',
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during translation'
    };
  }
}

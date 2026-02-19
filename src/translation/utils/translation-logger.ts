/**
 * Translation logging utility
 * Provides structured logging for translation operations
 */

import type { FastifyInstance } from 'fastify';
import type { TranslationLogEntry, TranslationDirection } from '../types.js';

/**
 * Logs a translation operation with structured information
 * @param logger Fastify logger instance
 * @param entry Translation log entry
 */
export function logTranslation(logger: FastifyInstance['log'], entry: TranslationLogEntry): void {
  if (entry.success) {
    logger.info({
      action: 'translation_completed',
      requestId: entry.requestId,
      translationDirection: entry.translationDirection,
      mode: entry.mode,
      unknownFieldsCount: entry.unknownFields.length,
      unknownFields: entry.unknownFields,
      timestamp: entry.timestamp
    }, `Translation completed: ${entry.translationDirection}`);
  } else {
    logger.error({
      action: 'translation_failed',
      requestId: entry.requestId,
      translationDirection: entry.translationDirection,
      mode: entry.mode,
      error: entry.error,
      timestamp: entry.timestamp
    }, `Translation failed: ${entry.error}`);
  }
}

/**
 * Logs when unknown fields are detected during translation
 * @param logger Fastify logger instance
 * @param requestId Request identifier
 * @param direction Translation direction
 * @param unknownFields List of unknown field names
 */
export function logUnknownFields(
  logger: FastifyInstance['log'],
  requestId: string,
  direction: TranslationDirection,
  unknownFields: string[]
): void {
  if (unknownFields.length > 0) {
    logger.debug({
      action: 'unknown_fields_detected',
      requestId,
      direction,
      count: unknownFields.length,
      fields: unknownFields
    }, `Unknown fields detected in ${direction} translation: ${unknownFields.join(', ')}`);
  }
}

/**
 * Logs a translation error with context
 * @param logger Fastify logger instance
 * @param requestId Request identifier
 * @param direction Translation direction
 * @param error Error message or Error object
 */
export function logTranslationError(
  logger: FastifyInstance['log'],
  requestId: string,
  direction: TranslationDirection,
  error: string | Error
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  
  logger.error({
    action: 'translation_error',
    requestId,
    direction,
    error: errorMessage
  }, `Translation error in ${direction}: ${errorMessage}`);
}

/**
 * Creates a translation log entry from operation data
 * @param requestId Request identifier
 * @param direction Translation direction
 * @param mode Translation mode (translate or pass_through)
 * @param unknownFields List of unknown fields
 * @param success Whether translation was successful
 * @param error Optional error message if failed
 * @returns TranslationLogEntry
 */
export function createTranslationLogEntry(
  requestId: string,
  direction: TranslationDirection,
  mode: 'translate' | 'pass_through',
  unknownFields: string[],
  success: boolean,
  error?: string
): TranslationLogEntry {
  return {
    requestId,
    translationDirection: direction,
    mode,
    unknownFields,
    timestamp: new Date().toISOString(),
    success,
    error
  };
}

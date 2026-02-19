/**
 * Chat Completions → Response API translation types
 */

import type { ResponseApiRequest } from '../types.js';

/**
 * Result of Chat → Response translation
 */
export interface ChatToResponseTranslationResult {
  success: boolean;
  translated?: ResponseApiRequest;
  error?: string;
  unknownFields: string[];
  multi_turn_detected: boolean;
}

/**
 * Options for Chat → Response translation
 */
export interface ChatToResponseTranslationOptions {
  requestId: string;
  strict?: boolean; // If true, fail on unknown fields instead of passing through
}

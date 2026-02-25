/**
 * Response API → Chat Completions translation types
 */

import type { ChatCompletionsRequest } from '../types.js';

/**
 * Result of Response → Chat translation
 */
export interface ResponseToChatTranslationResult {
  success: boolean;
  translated?: ChatCompletionsRequest;
  error?: string;
  unknownFields: string[];
}

/**
 * Options for Response → Chat translation
 */
export interface ResponseToChatTranslationOptions {
  requestId: string;
  strict?: boolean; // If true, fail on unknown fields instead of passing through
}

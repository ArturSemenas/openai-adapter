/**
 * Translation types and interfaces
 */

/**
 * Supported translation directions
 */
export type TranslationDirection = 
  | 'chat_to_response'
  | 'response_to_chat'
  | 'chat_to_response_response'
  | 'response_to_chat_response';

/**
 * Translation mode indicates whether we're translating or passing through
 */
export type TranslationMode = 'translate' | 'pass_through';

/**
 * Result of unknown field detection
 */
export interface UnknownFieldsResult {
  unknownFields: string[];
  cleanedPayload: Record<string, unknown>;
}

/**
 * Structured translation log entry
 */
export interface TranslationLogEntry {
  requestId: string;
  translationDirection: TranslationDirection;
  mode: TranslationMode;
  unknownFields: string[];
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Round-trip test result
 */
export interface RoundTripTestResult {
  success: boolean;
  original: unknown;
  translated: unknown;
  backTranslated: unknown;
  differences: string[];
  semanticEquivalence: {
    model: boolean;
    content: boolean;
    parameters: boolean;
  };
}

/**
 * Chat Completions request format
 */
export interface ChatCompletionsRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  n?: number;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string | Record<string, unknown>;
  response_format?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Response API request format
 */
export interface ResponseApiRequest {
  model: string;
  input?: string | Array<Record<string, unknown>>;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string | Record<string, unknown>;
  text?: {
    format?: string;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Translation context with metadata
 */
export interface TranslationContext {
  requestId: string;
  direction: TranslationDirection;
  mode: TranslationMode;
  startTimeNs: bigint;
}

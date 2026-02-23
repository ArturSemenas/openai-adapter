/**
 * Translation module exports
 * Provides access to all translation utilities, interfaces, and translation functions
 */

// Interfaces (ISP compliance - segregated interfaces)
export * from './interfaces.js';

// Utilities
export * from './utils/unknown-fields.js';
export * from './utils/translation-logger.js';
export * from './utils/round-trip-tester.js';
export * from './utils/translation-orchestrator.js';

// Types
export * from './types.js';

// Chat → Response translation
export * from './chat-to-response/types.js';
export * from './chat-to-response/request.js';
export * from './chat-to-response/request-translator.js';

// Main exports for convenience
export { translateChatToResponse, isChatCompletionsRequest } from './chat-to-response/request.js';
export { createChatToResponseRequestTranslator } from './chat-to-response/request-translator.js';

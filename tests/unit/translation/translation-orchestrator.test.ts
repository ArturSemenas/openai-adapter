/**
 * Unit tests for translation orchestrator
 * Tests orchestration of translation with logging
 */

import { describe, it, expect, vi } from 'vitest';
import { orchestrateRequestTranslation } from '../../../src/translation/utils/translation-orchestrator.js';
import type { RequestTranslator } from '../../../src/translation/interfaces.js';

describe('orchestrateRequestTranslation', () => {
  describe('Request Validation', () => {
    it('validates request before translation', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(false),
        translateRequest: vi.fn()
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        {},
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockTranslator.translateRequest).not.toHaveBeenCalled();
    });

    it('returns error when request validation fails', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(false),
        translateRequest: vi.fn()
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { invalid: 'request' },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match expected format');
      expect(result.unknownFields).toEqual([]);
    });
  });

  describe('Translation Execution', () => {
    it('calls translator with correct parameters', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const request = { model: 'gpt-4', messages: [] };
      
      orchestrateRequestTranslation(
        mockTranslator,
        request,
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(mockTranslator.translateRequest).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          requestId: 'test-123'
        })
      );
    });

    it('returns successful translation result', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.translated).toEqual({ model: 'gpt-4', input: [] });
    });

    it('returns failed translation result', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: false,
          error: 'Translation failed',
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Translation failed');
    });
  });

  describe('Logging', () => {
    it('logs translation results on success', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(mockLogger.info).toHaveBeenCalled();
      const infoCall = mockLogger.info.mock.calls[0];
      expect(infoCall[0]).toMatchObject({
        action: 'translation_completed',
        requestId: 'test-123',
        translationDirection: 'chat_to_response'
      });
    });

    it('logs translation error on failure', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: false,
          error: 'Translation failed',
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0];
      expect(errorCall[0]).toMatchObject({
        action: 'translation_failed',
        requestId: 'test-123',
        translationDirection: 'chat_to_response'
      });
    });

    it('logs unknown fields when detected', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: ['custom_field', 'another_field']
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(mockLogger.debug).toHaveBeenCalled();
      const debugCall = mockLogger.debug.mock.calls[0];
      expect(debugCall[0]).toMatchObject({
        action: 'unknown_fields_detected',
        requestId: 'test-123',
        direction: 'chat_to_response',
        count: 2,
        fields: ['custom_field', 'another_field']
      });
    });

    it('does not log unknown fields when none detected', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('logs multi-turn detection when applicable', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: [],
          multi_turn_detected: true
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      const infoCalls = mockLogger.info.mock.calls;
      const multiTurnLog = infoCalls.find(
        (call) => call[0].action === 'multi_turn_conversation_detected'
      );
      
      expect(multiTurnLog).toBeDefined();
      expect(multiTurnLog?.[0]).toMatchObject({
        requestId: 'test-123',
        direction: 'chat_to_response'
      });
    });

    it('does not log multi-turn when not detected', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: [],
          multi_turn_detected: false
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      const infoCalls = mockLogger.info.mock.calls;
      const multiTurnLog = infoCalls.find(
        (call) => call[0].action === 'multi_turn_conversation_detected'
      );
      
      expect(multiTurnLog).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('catches and logs translator exceptions', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockImplementation(() => {
          throw new Error('Translator crashed');
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Translator crashed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('handles non-Error exceptions', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockImplementation(() => {
          throw 'String error'; // eslint-disable-line no-throw-literal
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Generic Type Support', () => {
    it('works with generic type parameters', () => {
      const mockTranslator: RequestTranslator<Record<string, unknown>, Record<string, unknown>> = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { result: 'data' },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      const result = orchestrateRequestTranslation(
        mockTranslator,
        { input: 'data' },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response'
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.translated).toEqual({ result: 'data' });
    });
  });

  describe('Options Handling', () => {
    it('passes strict option to translator', () => {
      const mockTranslator: RequestTranslator = {
        isValidRequest: vi.fn().mockReturnValue(true),
        translateRequest: vi.fn().mockReturnValue({
          success: true,
          translated: { model: 'gpt-4', input: [] },
          unknownFields: []
        })
      };
      
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };
      
      orchestrateRequestTranslation(
        mockTranslator,
        { model: 'gpt-4', messages: [] },
        {
          logger: mockLogger as unknown as ReturnType<typeof vi.fn>,
          requestId: 'test-123',
          direction: 'chat_to_response',
          strict: true
        }
      );
      
      expect(mockTranslator.translateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          strict: true
        })
      );
    });
  });
});

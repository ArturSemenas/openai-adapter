import { describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { handleChatToResponseTranslation } from '../../../src/handlers/translation.handler.js';
import type { RequestTranslator } from '../../../src/translation/interfaces.js';
import { createChatToResponseRequestTranslator } from '../../../src/translation/chat-to-response/request-translator.js';

describe('handleChatToResponseTranslation', () => {
  it('should accept optional translator parameter (4th parameter)', () => {
    // This test should fail initially because handler only accepts 3 parameters
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const mockTranslator: RequestTranslator = {
      isValidRequest: vi.fn().mockReturnValue(true),
      translateRequest: vi.fn().mockReturnValue({
        success: true,
        translated: { model: 'gpt-4', input: [] },
        unknownFields: []
      })
    };

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // This call should work with 4 parameters after refactoring
    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      mockTranslator
    );

    expect(result.success).toBe(true);
  });

  it('should use default translator when translator parameter is not provided', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // This should work with 3 parameters (backward compatibility)
    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request
    );

    expect(result.success).toBe(true);
  });

  it('should delegate to orchestrator when translator is injected', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const mockTranslator: RequestTranslator = {
      isValidRequest: vi.fn().mockReturnValue(true),
      translateRequest: vi.fn().mockReturnValue({
        success: true,
        translated: { model: 'gpt-4', input: [] },
        unknownFields: []
      })
    };

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      mockTranslator
    );

    // Verify translator was used
    expect(mockTranslator.isValidRequest).toHaveBeenCalledWith(request);
    expect(mockTranslator.translateRequest).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should return correct result format from orchestrator', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const mockTranslator: RequestTranslator = {
      isValidRequest: vi.fn().mockReturnValue(true),
      translateRequest: vi.fn().mockReturnValue({
        success: true,
        translated: { model: 'gpt-4', input: [{ role: 'user', content: 'Hello' }] },
        unknownFields: ['extra_field'],
        error: undefined
      })
    };

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      mockTranslator
    );

    expect(result).toEqual({
      success: true,
      translated: { model: 'gpt-4', input: [{ role: 'user', content: 'Hello' }] },
      error: undefined
    });
  });

  it('should handle translation errors through orchestrator', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const mockTranslator: RequestTranslator = {
      isValidRequest: vi.fn().mockReturnValue(true),
      translateRequest: vi.fn().mockReturnValue({
        success: false,
        translated: undefined,
        unknownFields: [],
        error: 'Translation failed'
      })
    };

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      mockTranslator
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Translation failed');
    expect(result.translated).toBeUndefined();
  });

  it('should handle invalid requests through orchestrator', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const mockTranslator: RequestTranslator = {
      isValidRequest: vi.fn().mockReturnValue(false),
      translateRequest: vi.fn()
    };

    const request = { invalid: 'request' };

    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      mockTranslator
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockTranslator.translateRequest).not.toHaveBeenCalled();
  });

  it('should work with default translator factory function', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // Create translator using factory
    const translator = createChatToResponseRequestTranslator();
    
    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request,
      translator
    );

    expect(result.success).toBe(true);
  });

  it('should maintain backward compatibility with existing code', () => {
    const mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as FastifyInstance['log'];

    const request = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // Original 3-parameter call should still work
    const result = handleChatToResponseTranslation(
      mockLogger,
      'test-123',
      request
    );

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });
});
/**
 * Unit tests for ChatToResponseRequestTranslator
 * Tests RequestTranslator interface implementation
 */

import { describe, it, expect } from 'vitest';
import { ChatToResponseRequestTranslator, createChatToResponseRequestTranslator } from '../../../src/translation/chat-to-response/request-translator.js';
import type { RequestTranslator } from '../../../src/translation/interfaces.js';

describe('ChatToResponseRequestTranslator', () => {
  describe('Interface Implementation', () => {
    it('implements RequestTranslator interface', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      expect(translator.translateRequest).toBeDefined();
      expect(translator.isValidRequest).toBeDefined();
      expect(typeof translator.translateRequest).toBe('function');
      expect(typeof translator.isValidRequest).toBe('function');
    });

    it('can be instantiated via factory function', () => {
      const translator = createChatToResponseRequestTranslator();
      
      expect(translator).toBeInstanceOf(ChatToResponseRequestTranslator);
      expect(translator.translateRequest).toBeDefined();
      expect(translator.isValidRequest).toBeDefined();
    });
  });

  describe('isValidRequest', () => {
    it('returns true for valid Chat Completions request', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const validRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      expect(translator.isValidRequest(validRequest)).toBe(true);
    });

    it('returns false for empty object', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      expect(translator.isValidRequest({})).toBe(false);
    });

    it('returns false for missing model', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      expect(translator.isValidRequest(request)).toBe(false);
    });

    it('returns false for missing messages', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4'
      };
      
      expect(translator.isValidRequest(request)).toBe(false);
    });

    it('returns false for empty messages array', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: []
      };
      
      expect(translator.isValidRequest(request)).toBe(false);
    });

    it('returns false for invalid message structure', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' }] // missing content
      };
      
      expect(translator.isValidRequest(request)).toBe(false);
    });

    it('returns false for non-object input', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      expect(translator.isValidRequest('string' as unknown)).toBe(false);
      expect(translator.isValidRequest(123 as unknown)).toBe(false);
      expect(translator.isValidRequest(null as unknown)).toBe(false);
      expect(translator.isValidRequest(undefined as unknown)).toBe(false);
    });
  });

  describe('translateRequest', () => {
    it('translates valid Chat Completions request successfully', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated).toBeDefined();
      expect(result.translated?.model).toBe('gpt-4');
      expect(result.translated?.input).toEqual(request.messages);
      expect(result.unknownFields).toEqual([]);
    });

    it('preserves multi_turn_detected in result', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' }
        ]
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect((result as Record<string, unknown>).multi_turn_detected).toBe(true);
    });

    it('handles temperature parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.temperature).toBe(0.7);
    });

    it('handles max_tokens parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.max_output_tokens).toBe(100);
    });

    it('handles max_completion_tokens fallback', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_completion_tokens: 200
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.max_output_tokens).toBe(200);
    });

    it('handles top_p parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 0.9
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.top_p).toBe(0.9);
    });

    it('handles stream parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.stream).toBe(true);
    });

    it('handles tools parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const tools = [{ type: 'function', function: { name: 'test' } }];
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.tools).toEqual(tools);
    });

    it('handles tool_choice parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tool_choice: 'auto'
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.tool_choice).toBe('auto');
    });

    it('handles response_format parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        response_format: { type: 'json_object' }
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.text).toEqual({ format: 'json_object' });
    });

    it('handles metadata parameter', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { key: 'value' }
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect(result.translated?.metadata).toEqual({ key: 'value' });
    });

    it('passes through unknown fields', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        custom_field: 'custom_value'
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(true);
      expect((result.translated as Record<string, unknown>).custom_field).toBe('custom_value');
    });

    it('returns error for invalid request', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const result = translator.translateRequest(null as unknown, { requestId: 'test-123' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.translated).toBeUndefined();
    });

    it('returns error for missing model', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Model field is required');
    });

    it('returns error for missing messages', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4'
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Messages array is required');
    });

    it('returns error for empty messages', () => {
      const translator = new ChatToResponseRequestTranslator();
      
      const request = {
        model: 'gpt-4',
        messages: []
      };
      
      const result = translator.translateRequest(request, { requestId: 'test-123' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Messages array is required');
    });
  });

  describe('Generic Type Support', () => {
    it('works with generic type parameters', () => {
      const translator: RequestTranslator<Record<string, unknown>, Record<string, unknown>> = 
        new ChatToResponseRequestTranslator();
      
      expect(translator.isValidRequest).toBeDefined();
      expect(translator.translateRequest).toBeDefined();
    });
  });
});

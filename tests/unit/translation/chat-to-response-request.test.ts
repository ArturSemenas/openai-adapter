/**
 * Unit tests for Chat Completions → Response API translation
 */

import { describe, it, expect } from 'vitest';
import {
  translateChatToResponse,
  isChatCompletionsRequest
} from '../../../src/translation/chat-to-response/request.js';

describe('Chat to Response Translation', () => {
  describe('translateChatToResponse - Basic Translation', () => {
    it('should translate simple Chat request to Response format', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
        temperature: 0.7,
        max_tokens: 100
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated).toBeDefined();
      expect(result.translated?.model).toBe('gpt-4');
      expect(result.translated?.input).toEqual([{ role: 'user', content: 'Hello, world!' }]);
      expect(result.translated?.temperature).toBe(0.7);
      expect(result.translated?.max_output_tokens).toBe(100);
      expect(result.multi_turn_detected).toBe(false);
    });

    it('should extract last message from messages array', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Last message' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.input).toEqual([
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Last message' }
      ]);
      expect(result.multi_turn_detected).toBe(true);
    });

    it('should pass messages array directly to input field', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.input).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should handle single message', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.input).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should handle system-only message', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Be helpful' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.input).toEqual([{ role: 'system', content: 'Be helpful' }]);
    });

    it('should handle developer role in messages', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'developer', content: 'Custom instructions' },
          { role: 'user', content: 'Hello' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.input).toEqual([
        { role: 'developer', content: 'Custom instructions' },
        { role: 'user', content: 'Hello' }
      ]);
    });
  });

  describe('Field Mapping', () => {
    it('should map temperature correctly', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.temperature).toBe(0.5);
    });

    it('should map max_tokens to max_output_tokens', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 200
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.max_output_tokens).toBe(200);
    });

    it('should map max_completion_tokens to max_output_tokens', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_completion_tokens: 200
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.max_output_tokens).toBe(200);
    });

    it('should map top_p correctly', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 0.9
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.top_p).toBe(0.9);
    });

    it('should map stream correctly', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.stream).toBe(true);
    });

    it('should map tools array correctly', () => {
      const tools = [
        { type: 'function', function: { name: 'test_func' } }
      ];

      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.tools).toEqual(tools);
    });

    it('should map tool_choice correctly', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tool_choice: 'auto'
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.tool_choice).toBe('auto');
    });

    it('should map response_format to text.format', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        response_format: { type: 'json_object' }
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.text?.format).toBe('json_object');
    });

    it('should map metadata correctly', () => {
      const metadata = { user_id: '123', session_id: 'abc' };

      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.metadata).toEqual(metadata);
    });
  });

  describe('Unsupported Fields', () => {
    it('should drop frequency_penalty', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        frequency_penalty: 0.5
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.frequency_penalty).toBeUndefined();
    });

    it('should drop presence_penalty', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        presence_penalty: 0.5
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.presence_penalty).toBeUndefined();
    });

    it('should drop n parameter', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        n: 3
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.translated?.n).toBeUndefined();
    });
  });

  describe('Unknown Fields (Forward Compatibility)', () => {
    it('should pass through unknown fields', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        future_field_1: 'value1',
        future_field_2: 42
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.unknownFields).toContain('future_field_1');
      expect(result.unknownFields).toContain('future_field_2');
      const translated = result.translated as Record<string, unknown> | undefined;
      expect(translated?.future_field_1).toBe('value1');
      expect(translated?.future_field_2).toBe(42);
    });

    it('should detect unknown fields in result', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        custom_param: 'custom_value'
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.unknownFields).toContain('custom_param');
      expect(result.unknownFields.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should fail when request is not an object', () => {
      const result = translateChatToResponse(null, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('object');
    });

    it('should fail when model is missing', () => {
      const chatRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Model');
    });

    it('should fail when model is not a string', () => {
      const chatRequest = {
        model: 123,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Model');
    });

    it('should fail when messages is missing', () => {
      const chatRequest = {
        model: 'gpt-4'
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Messages');
    });

    it('should fail when messages is empty', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: []
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Messages');
    });

    it('should fail when messages is not an array', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: { role: 'user', content: 'Hello' }
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Messages');
    });

    it('should fail when content is not a string', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 123 }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('content');
      expect(result.error).toContain('index 0'); // LOW-3: Better error messages
    });

    it('should fail with invalid role type (LOW-2 validation)', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'invalid_role', content: 'Hello' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid role');
      expect(result.error).toContain('invalid_role');
      expect(result.error).toContain('system, user, assistant, developer, tool');
    });

    it('should fail when role is missing with better error (LOW-3)', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ content: 'Hello' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('role must be a string');
      expect(result.error).toContain('got undefined');
      expect(result.error).toContain('index 0');
    });
  });

  describe('Multi-turn Detection', () => {
    it('should detect multi-turn conversation', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Second' }
        ]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.multi_turn_detected).toBe(true);
    });

    it('should not detect multi-turn with single message', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Only one message' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.multi_turn_detected).toBe(false);
    });
  });

  describe('isChatCompletionsRequest', () => {
    it('should identify valid Chat request', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      expect(isChatCompletionsRequest(request)).toBe(true);
    });

    it('should reject non-object', () => {
      expect(isChatCompletionsRequest(null)).toBe(false);
      expect(isChatCompletionsRequest('string')).toBe(false);
      expect(isChatCompletionsRequest(123)).toBe(false);
    });

    it('should reject missing model', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      expect(isChatCompletionsRequest(request)).toBe(false);
    });

    it('should reject empty messages', () => {
      const request = {
        model: 'gpt-4',
        messages: []
      };

      expect(isChatCompletionsRequest(request)).toBe(false);
    });

    it('should reject invalid message format', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' }] // missing content
      };

      expect(isChatCompletionsRequest(request)).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle request with all mapped fields', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' }
        ],
        temperature: 0.7,
        max_tokens: 150,
        top_p: 0.9,
        stream: true,
        tools: [{ type: 'function', function: { name: 'test' } }],
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        metadata: { session: 'abc123' }
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated).toBeDefined();
      expect(result.translated?.model).toBe('gpt-4');
      expect(result.translated?.input).toEqual([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' }
      ]);
      expect(result.translated?.temperature).toBe(0.7);
      expect(result.translated?.max_output_tokens).toBe(150);
      expect(result.translated?.top_p).toBe(0.9);
      expect(result.translated?.stream).toBe(true);
      expect(result.translated?.tools).toBeDefined();
      expect(result.translated?.tool_choice).toBe('auto');
      expect(result.translated?.text?.format).toBe('json_object');
      expect(result.translated?.metadata).toEqual({ session: 'abc123' });
    });

    it('should handle minimal valid request', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.translated?.model).toBe('gpt-4');
      expect(result.translated?.input).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(Object.keys(result.translated ?? {})).toHaveLength(2);
    });

    it('should pass through unknown fields in translated output (MED-3 validation)', () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        custom_field_1: 'value1',
        future_api_field: 123,
        experimental_feature: { nested: 'data' }
      };

      const result = translateChatToResponse(chatRequest, { requestId: 'test-123' });

      expect(result.success).toBe(true);
      expect(result.unknownFields).toEqual(['custom_field_1', 'future_api_field', 'experimental_feature']);
      
      // Validate unknown fields are actually in the translated output
      const translated = result.translated as Record<string, unknown>;
      expect(translated.custom_field_1).toBe('value1');
      expect(translated.future_api_field).toBe(123);
      expect(translated.experimental_feature).toEqual({ nested: 'data' });
      
      // Verify known fields are also present
      expect(translated.model).toBe('gpt-4');
      expect(translated.input).toEqual([{ role: 'user', content: 'Hello' }]);
    });
  });
});

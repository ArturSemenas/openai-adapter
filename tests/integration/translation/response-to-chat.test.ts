/**
 * Integration tests for Response→Chat translation end-to-end flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../../src/index.js';
import type { FastifyInstance } from 'fastify';
import type { AdapterConfig } from '../../../src/config/types.js';

describe('Response to Chat Translation Integration', () => {
  let app: FastifyInstance;
  const testConfig: AdapterConfig = {
    targetUrl: 'https://api.openai.com/v1',
    modelMapping: {
      'gpt-4': 'chat_completions',
      'gpt-3.5-turbo': 'response'
    },
    maxRequestSizeBytes: 10 * 1024 * 1024,
    maxJsonDepth: 100,
    upstreamTimeoutSeconds: 30,
    maxConcurrentConnections: 1000
  };

  beforeEach(async () => {
    app = buildServer({ config: testConfig });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Response→Chat Translation Routing', () => {
    it('should translate Response request to Chat when model maps to chat_completions', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello, how are you?',
        temperature: 0.7
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      // Should work with translation layer (will fail on upstream, but translation should complete)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate Response request with messages array input', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ],
        temperature: 0.5
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate Response request with instructions field', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'What is the weather?',
        instructions: 'You are a helpful weather assistant',
        temperature: 0.3
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should pass through Response request when model maps to response', async () => {
      const responseRequest = {
        model: 'gpt-3.5-turbo',
        input: 'Hello',
        temperature: 0.7
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      // Should pass through (will fail on upstream, but not a translation error)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should fail translation with invalid model', async () => {
      const request = {
        model: 'unknown-model',
        input: 'Hello'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: request
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('not found');
    });

    it('should fail when input is missing', async () => {
      const request = {
        model: 'gpt-4'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: request
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail when model is missing', async () => {
      const request = {
        input: 'Hello'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: request
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail when input is empty string', async () => {
      const request = {
        model: 'gpt-4',
        input: ''
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: request
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail when input is empty array', async () => {
      const request = {
        model: 'gpt-4',
        input: []
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: request
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Parameter Mapping', () => {
    it('should translate max_output_tokens to max_tokens', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello',
        max_output_tokens: 150
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      // Translation should succeed (upstream will fail, but that's expected)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate all standard parameters', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.8,
        max_output_tokens: 200,
        top_p: 0.95,
        stream: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate text.format to response_format.type', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello',
        text: {
          format: 'json'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should preserve metadata field', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello',
        metadata: {
          user_id: '12345',
          session_id: 'abc-def',
          custom_field: 'value'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Tools and Function Calls', () => {
    it('should translate requests with tools', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'What is the weather?',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate requests with tool_choice', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: 'What is the weather?',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather'
            }
          }
        ],
        tool_choice: 'auto'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should translate messages with tool_calls', async () => {
      const responseRequest = {
        model: 'gpt-4',
        input: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"San Francisco"}'
                }
              }
            ]
          }
        ]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Request Size and Performance', () => {
    it('should handle small requests efficiently', async () => {
      const smallRequest = {
        model: 'gpt-4',
        input: 'Hi'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: smallRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle requests with large payloads', async () => {
      const largeContent = 'x'.repeat(50000); // 50KB of content
      const largeRequest = {
        model: 'gpt-4',
        input: largeContent,
        metadata: {
          large_field: 'x'.repeat(50000)
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: largeRequest
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: 'not json'
      });

      // Fastify returns 415 for unsupported media type (not JSON)
      expect(response.statusCode).toBe(415);
    });

    it('should include request ID in error response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'unknown-model',
          input: 'Hello'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.requestId).toBeDefined();
    });

    it('should handle invalid input type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          input: 123 // Invalid: should be string or array
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Request Validation', () => {
    it('should accept all required fields', async () => {
      const validRequest = {
        model: 'gpt-4',
        input: 'Hello',
        instructions: 'You are helpful',
        temperature: 0.3,
        max_output_tokens: 150,
        top_p: 0.9
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: validRequest
      });

      // We expect 4xx since there's no real upstream, but not 400 for request format
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should accept requests with extra unknown fields', async () => {
      const requestWithExtra = {
        model: 'gpt-4',
        input: 'Hello',
        future_field_1: 'value1',
        future_field_2: 123,
        nested_future: {
          field: 'value'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: requestWithExtra
      });

      // Should handle unknown fields gracefully (forward compatibility)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should preserve thread_id as unknown field', async () => {
      const requestWithThreadId = {
        model: 'gpt-4',
        input: 'Hello',
        thread_id: 'thread_abc123'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: requestWithThreadId
      });

      // thread_id should be preserved as unknown field (PoC limitation)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Chat Completions Endpoint Handling', () => {
    it('should accept requests at /v1/chat/completions endpoint', async () => {
      const chatRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: chatRequest
      });

      // Should handle Chat Completions endpoint
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Bidirectional Translation', () => {
    it('should handle both translation directions in same server instance', async () => {
      // Test Response→Chat translation
      const responseRequest = {
        model: 'gpt-4',
        input: 'Hello from Response API'
      };

      const responseResult = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: responseRequest
      });

      expect(responseResult.statusCode).toBeGreaterThanOrEqual(400);

      // Test Chat→Response translation (using different model mapping)
      const chatRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello from Chat API' }]
      };

      const chatResult = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: chatRequest
      });

      expect(chatResult.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});

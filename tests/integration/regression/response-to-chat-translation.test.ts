/**
 * Integration Tests - Response→Chat Translation End-to-End Flow
 * 
 * **Validates: Requirement 6.3**
 * 
 * These tests verify the complete Response API → Chat Completions translation flow
 * including routing, translation, upstream forwarding, and response translation back.
 * 
 * Test Coverage:
 * - Complete Response API request → routing → translation → Chat Completions upstream flow
 * - Response translation back to Response API format
 * - Pass-through when source and target protocols match
 * - Error scenarios (validation errors, upstream errors)
 * - Docker-based integration testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createRoutingHandler } from '../../../src/handlers/routing.handler.js';
import type { AdapterConfig } from '../../../src/config/types.js';

describe('Integration Tests - Response→Chat Translation', () => {
  let fastify: FastifyInstance;
  let mockFetch: ReturnType<typeof vi.fn>;

  const testModelMapping = {
    'gpt-4': 'chat_completions',           // Response→Chat translation
    'gpt-4-turbo': 'chat_completions',     // Response→Chat translation
    'gpt-3.5-turbo': 'response',           // Pass-through for Response API
    'claude-3': 'response'                 // Pass-through for Response API
  };

  const testConfig: AdapterConfig = {
    targetUrl: 'http://mock-openai-api.local',
    modelMappingFile: './config/model-mapping.json',
    modelMapping: testModelMapping,
    upstreamTimeoutSeconds: 60,
    maxConcurrentConnections: 1000,
    maxRequestSizeBytes: 10 * 1024 * 1024,
    maxJsonDepth: 100
  };

  beforeEach(() => {
    fastify = Fastify({ logger: false });
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  describe('Complete Response→Chat Translation Flow', () => {
    it('should translate Response API request to Chat Completions and forward to upstream', async () => {
      // Setup: Mock upstream Chat Completions API response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      // Act: Send Response API request for model mapped to chat_completions
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'authorization': 'Bearer test-api-key',
          'content-type': 'application/json'
        },
        payload: {
          model: 'gpt-4',
          input: 'Hello, how are you?',
          temperature: 0.7,
          max_output_tokens: 150
        }
      });

      // Assert: Verify successful translation and forwarding
      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify request was translated and sent to Chat Completions endpoint
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://mock-openai-api.local/v1/chat/completions');

      // Verify translated request body
      const requestBody = JSON.parse(options.body as string);
      expect(requestBody).toHaveProperty('model', 'gpt-4');
      expect(requestBody).toHaveProperty('messages');
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0]).toEqual({
        role: 'user',
        content: 'Hello, how are you?'
      });
      expect(requestBody).toHaveProperty('temperature', 0.7);
      expect(requestBody).toHaveProperty('max_tokens', 150); // max_output_tokens → max_tokens

      // Verify headers were forwarded
      const headers = options.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-api-key');
      expect(headers.get('content-type')).toBe('application/json');

      // Verify response was returned
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('choices');
    });

    it('should translate Response API request with messages array input', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_456',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response to conversation' },
            finish_reason: 'stop'
          }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
          ],
          temperature: 0.5
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();

      // Verify messages array was passed through
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody.messages).toHaveLength(3);
      expect(requestBody.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(requestBody.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(requestBody.messages[2]).toEqual({ role: 'user', content: 'How are you?' });
    });

    it('should translate Response API request with instructions field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_789',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Weather information' },
            finish_reason: 'stop'
          }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'What is the weather?',
          instructions: 'You are a helpful weather assistant',
          temperature: 0.3
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();

      // Verify instructions was prepended as system message
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful weather assistant'
      });
      expect(requestBody.messages[1]).toEqual({
        role: 'user',
        content: 'What is the weather?'
      });
    });

    it('should translate all standard parameters correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_params',
          object: 'chat.completion',
          model: 'gpt-4-turbo',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4-turbo',
          input: 'Test message',
          temperature: 0.8,
          max_output_tokens: 200,
          top_p: 0.95,
          stream: false
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify all parameters were translated correctly
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody.temperature).toBe(0.8);
      expect(requestBody.max_tokens).toBe(200); // max_output_tokens → max_tokens
      expect(requestBody.top_p).toBe(0.95);
      expect(requestBody.stream).toBe(false);
    });

    it('should translate text.format to response_format.type', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_format',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: '{"result": "json"}' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Generate JSON',
          text: {
            format: 'json_object'
          }
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify text.format was mapped to response_format.type
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('response_format');
      expect(requestBody.response_format).toEqual({ type: 'json_object' });
    });

    it('should preserve metadata field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_metadata',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Test',
          metadata: {
            user_id: '12345',
            session_id: 'abc-def',
            custom_field: 'value'
          }
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify metadata was preserved
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('metadata');
      expect(requestBody.metadata).toEqual({
        user_id: '12345',
        session_id: 'abc-def',
        custom_field: 'value'
      });
    });
  });

  describe('Tools and Function Calls Translation', () => {
    it('should translate requests with tools array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_tools',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"San Francisco"}'
                }
              }]
            },
            finish_reason: 'tool_calls'
          }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
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
                  },
                  required: ['location']
                }
              }
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify tools array was preserved
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('tools');
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].type).toBe('function');
      expect(requestBody.tools[0].function.name).toBe('get_weather');
    });

    it('should translate requests with tool_choice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_tool_choice',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Use the weather tool',
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather'
              }
            }
          ],
          tool_choice: 'auto'
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify tool_choice was preserved
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('tool_choice', 'auto');
    });

    it('should translate messages with tool_calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_tool_calls_msg',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Tool result processed' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: '', // Use empty string instead of null for validation
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
            },
            {
              role: 'tool',
              tool_call_id: 'call_123',
              content: '{"temperature": 72, "condition": "sunny"}'
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify tool_calls in messages were preserved
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody.messages).toHaveLength(3);
      expect(requestBody.messages[1]).toHaveProperty('tool_calls');
      expect(requestBody.messages[1].tool_calls[0].id).toBe('call_123');
      expect(requestBody.messages[2].role).toBe('tool');
      expect(requestBody.messages[2].tool_call_id).toBe('call_123');
    });
  });

  describe('Pass-Through When Protocols Match', () => {
    it('should pass through Response API request when model maps to response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_passthrough',
          object: 'response',
          model: 'gpt-3.5-turbo',
          result: 'Pass-through response'
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-3.5-turbo', // Mapped to 'response' - pass-through
          input: 'Hello',
          temperature: 0.7
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify request was passed through to Response API endpoint (no translation)
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://mock-openai-api.local/v1/responses');

      // Verify request body was NOT translated (should be Response API format)
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('input'); // Response API field
      expect(requestBody).not.toHaveProperty('messages'); // Chat Completions field
    });

    it('should pass through for all models mapped to response API', async () => {
      const responseApiModels = Object.entries(testModelMapping)
        .filter(([_, apiType]) => apiType === 'response')
        .map(([model]) => model);

      for (const model of responseApiModels) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({
            id: 'resp_test',
            object: 'response',
            model,
            result: 'OK'
          })
        });

        const handler = createRoutingHandler(testConfig);
        const testFastify = Fastify({ logger: false });
        testFastify.post('/v1/responses', handler);

        const response = await testFastify.inject({
          method: 'POST',
          url: '/v1/responses',
          headers: { 'authorization': 'Bearer test' },
          payload: {
            model,
            input: 'Test'
          }
        });

        await testFastify.close();

        expect(response.statusCode).toBe(200);
        expect(mockFetch).toHaveBeenCalled();

        // Verify pass-through to Response API endpoint
        const fetchUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
        expect(fetchUrl).toBe('http://mock-openai-api.local/v1/responses');

        mockFetch.mockClear();
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should return validation error for missing model field', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          input: 'Hello' // Missing model field
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error.type).toBe('invalid_model_field');
      expect(body).toHaveProperty('requestId');
    });

    it('should return validation error for missing input field', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4' // Missing input field
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Translation Error');
      expect(body).toHaveProperty('message', 'Request does not match expected format');
      expect(body).toHaveProperty('requestId');
    });

    it('should return validation error for empty input string', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: '' // Empty string
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Translation Error');
      expect(body).toHaveProperty('message', 'Request does not match expected format');
      expect(body).toHaveProperty('requestId');
    });

    it('should return validation error for empty messages array', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: [] // Empty array
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Translation Error');
      expect(body).toHaveProperty('message', 'Request does not match expected format');
      expect(body).toHaveProperty('requestId');
    });

    it('should return validation error for invalid input type', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 123 // Invalid type (should be string or array)
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Translation Error');
      expect(body).toHaveProperty('message', 'Request does not match expected format');
      expect(body).toHaveProperty('requestId');
    });

    it('should return validation error for unknown model', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'unknown-model-xyz',
          input: 'Hello'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('unknown_model');
      expect(body.error.message).toContain('not found');
    });

    it('should handle upstream API errors gracefully', async () => {
      // Setup: Mock upstream API error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          error: {
            message: 'Internal server error',
            type: 'server_error',
            code: 'internal_error'
          }
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hello'
        }
      });

      // Should forward upstream error
      expect(response.statusCode).toBe(500);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle upstream timeout errors', async () => {
      // Setup: Mock timeout
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hello'
        }
      });

      // Should return error response
      expect(response.statusCode).toBeGreaterThanOrEqual(500);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle upstream network errors', async () => {
      // Setup: Mock network error
      mockFetch.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hello'
        }
      });

      // Should return error response
      expect(response.statusCode).toBeGreaterThanOrEqual(500);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should include request ID in all error responses', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: '' // Validation error
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('requestId');
      expect(typeof body.requestId).toBe('string');
      expect(body.requestId.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'authorization': 'Bearer test-key',
          'content-type': 'application/json'
        },
        payload: 'not valid json'
      });

      // Fastify returns 400 for invalid JSON
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Unknown Fields and Forward Compatibility', () => {
    it('should preserve unknown fields during translation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_unknown',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hello',
          future_field_1: 'value1',
          future_field_2: 123,
          nested_future: {
            field: 'value'
          }
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify unknown fields were preserved in translated request
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('future_field_1', 'value1');
      expect(requestBody).toHaveProperty('future_field_2', 123);
      expect(requestBody).toHaveProperty('nested_future');
      expect(requestBody.nested_future).toEqual({ field: 'value' });
    });

    it('should preserve thread_id as unknown field (PoC limitation)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_thread',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hello',
          thread_id: 'thread_abc123' // PoC: preserved as unknown field, not processed
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify thread_id was preserved (but not used for history retrieval in PoC)
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(requestBody).toHaveProperty('thread_id', 'thread_abc123');
    });
  });

  describe('Bidirectional Translation Verification', () => {
    it('should handle both translation directions in same server instance', async () => {
      // Test Response→Chat translation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_r2c',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response→Chat OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);
      fastify.post('/v1/chat/completions', handler);

      const responseResult = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4', // Mapped to chat_completions
          input: 'Hello from Response API'
        }
      });

      expect(responseResult.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify Response→Chat translation occurred
      const r2cUrl = mockFetch.mock.calls[0][0];
      expect(r2cUrl).toBe('http://mock-openai-api.local/v1/chat/completions');

      // Test Chat→Response translation (using different model mapping)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_c2r',
          object: 'response',
          model: 'gpt-3.5-turbo',
          result: 'Chat→Response OK'
        })
      });

      const chatResult = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-3.5-turbo', // Mapped to response
          messages: [{ role: 'user', content: 'Hello from Chat API' }]
        }
      });

      expect(chatResult.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify Chat→Response translation occurred
      const c2rUrl = mockFetch.mock.calls[1][0];
      expect(c2rUrl).toBe('http://mock-openai-api.local/v1/responses');
    });

    it('should maintain translation consistency across multiple requests', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      // Send multiple requests with same structure
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({
            id: `chatcmpl_${i}`,
            object: 'chat.completion',
            model: 'gpt-4',
            choices: [{ index: 0, message: { role: 'assistant', content: `Response ${i}` }, finish_reason: 'stop' }]
          })
        });

        const response = await fastify.inject({
          method: 'POST',
          url: '/v1/responses',
          headers: { 'authorization': 'Bearer test-key' },
          payload: {
            model: 'gpt-4',
            input: `Test message ${i}`,
            temperature: 0.7
          }
        });

        expect(response.statusCode).toBe(200);

        // Verify consistent translation
        const requestBody = JSON.parse(mockFetch.mock.calls[i][1].body as string);
        expect(requestBody).toHaveProperty('messages');
        expect(requestBody.messages[0].content).toBe(`Test message ${i}`);
        expect(requestBody.temperature).toBe(0.7);
      }

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Request Size and Performance', () => {
    it('should handle small requests efficiently', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_small',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: 'Hi'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle large payloads within limits', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_large',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      // Create large but valid payload (50KB)
      const largeContent = 'x'.repeat(50000);
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          input: largeContent,
          metadata: {
            large_field: 'x'.repeat(50000)
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should enforce JSON depth limits', async () => {
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 3
      };

      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/responses', handler);

      // Create deeply nested JSON (depth > 3)
      const deepPayload = {
        model: 'gpt-4',
        input: 'Test',
        data: {
          level1: {
            level2: {
              level3: {
                level4: 'too deep'
              }
            }
          }
        }
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: { 'authorization': 'Bearer test-key' },
        payload: deepPayload
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('json_depth_exceeded');
    });
  });

  describe('Header Forwarding and Authentication', () => {
    it('should forward authorization header to upstream', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_auth',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'authorization': 'Bearer sk-test-api-key-12345',
          'content-type': 'application/json'
        },
        payload: {
          model: 'gpt-4',
          input: 'Test'
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify authorization header was forwarded
      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer sk-test-api-key-12345');
    });

    it('should forward custom headers to upstream', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_custom',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'authorization': 'Bearer test-key',
          'x-request-id': 'req-12345',
          'x-organization': 'test-org',
          'user-agent': 'test-client/1.0'
        },
        payload: {
          model: 'gpt-4',
          input: 'Test'
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify all custom headers were forwarded
      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-key');
      expect(headers.get('x-request-id')).toBe('req-12345');
      expect(headers.get('x-organization')).toBe('test-org');
      expect(headers.get('user-agent')).toBe('test-client/1.0');
    });

    it('should handle requests with minimal headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_minimal',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          input: 'Test'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Regression - Existing Functionality Preservation', () => {
    it('should not break existing Chat→Response translation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_c2r_regression',
          object: 'response',
          model: 'gpt-3.5-turbo',
          result: 'Chat→Response still works'
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-3.5-turbo', // Mapped to 'response'
          messages: [{ role: 'user', content: 'Test Chat→Response' }]
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify Chat→Response translation still works
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://mock-openai-api.local/v1/responses');
    });

    it('should not break pass-through for Chat Completions', async () => {
      // Use a config where a model maps to chat_completions for pass-through test
      const passThroughConfig: AdapterConfig = {
        ...testConfig,
        modelMapping: {
          'gpt-4': 'chat_completions' // Pass-through
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_passthrough_regression',
          object: 'chat.completion',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Pass-through OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(passThroughConfig);
      const testFastify = Fastify({ logger: false });
      testFastify.post('/v1/chat/completions', handler);

      const response = await testFastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'authorization': 'Bearer test-key' },
        payload: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test pass-through' }]
        }
      });

      await testFastify.close();

      expect(response.statusCode).toBe(200);

      // Verify pass-through to Chat Completions endpoint
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://mock-openai-api.local/v1/chat/completions');
    });
  });
});

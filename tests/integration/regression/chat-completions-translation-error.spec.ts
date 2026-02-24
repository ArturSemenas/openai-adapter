import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createRoutingHandler } from '../../../src/handlers/routing.handler.js';
import type { AdapterConfig } from '../../../src/config/types.js';

/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * This test explores the bug condition where the routing handler loses Fastify request
 * properties when translating chat completions requests to Response API format.
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * The failure confirms the bug exists (headers become undefined due to spread operator).
 * 
 * **Property 1: Fault Condition - Request Object Preservation During Translation**
 * 
 * For any chat completions request where translation to Response API is required
 * (isBugCondition returns true), the routing handler SHALL preserve the original
 * Fastify request object structure and only modify the body property, ensuring
 * that request.headers and all other Fastify properties remain accessible.
 * 
 * Bug Condition: isBugCondition returns true when:
 * - routingDecision.decision === 'translate'
 * - sourceFormat === 'chat_completions'
 * - targetFormat === 'response'
 * - translationSucceeds(request.body)
 */
describe('Bug Condition Exploration - Chat Completions Translation Error', () => {
  let fastify: FastifyInstance;
  let mockFetch: ReturnType<typeof vi.fn>;

  const testModelMapping = {
    'gpt-4': 'response', // Model mapped to Response API (triggers translation)
    'gpt-3.5-turbo': 'chat_completions' // Model mapped to Chat Completions (pass-through)
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
    // Create fresh Fastify instance for each test
    fastify = Fastify({ logger: false });
    
    // Mock global fetch to simulate upstream API
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  describe('Property 1: Request Object Preservation During Translation', () => {
    it('should preserve request.headers when translating chat completions to Response API format', async () => {
      // Setup: Configure mock upstream to return success
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json'
        }),
        text: async () => JSON.stringify({
          id: 'resp_123',
          object: 'response',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?'
            },
            finish_reason: 'stop'
          }]
        })
      });

      // Register routing handler
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send chat completions request for model mapped to Response API
      // This triggers the bug condition:
      // - Endpoint: /v1/chat/completions (sourceFormat: chat_completions)
      // - Model: gpt-4 (mapped to 'response' in testModelMapping)
      // - Decision: translate (chat_completions → response)
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'authorization': 'Bearer test-api-key',
          'content-type': 'application/json',
          'x-custom-header': 'test-value'
        },
        payload: {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          temperature: 0.7,
          max_tokens: 100
        }
      });

      // Assert: Verify the request was successfully processed
      // 
      // **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS
      // - Status code will be 503 (Service Unavailable)
      // - Error message: "Failed to communicate with OpenAI API"
      // - Details: TypeError "Cannot convert undefined or null to object"
      // - Root cause: request.headers is undefined in pass-through handler
      //
      // **EXPECTED OUTCOME ON FIXED CODE**: Test PASSES
      // - Status code will be 200 (Success)
      // - Headers are preserved and forwarded to upstream API
      // - Response is returned successfully
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('choices');

      // Verify that fetch was called (confirms request reached pass-through handler)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify that headers were forwarded to upstream API
      const fetchCall = mockFetch.mock.calls[0];
      const [url, options] = fetchCall;
      
      expect(url).toBe('http://mock-openai-api.local/v1/responses');
      expect(options.headers).toBeDefined();
      
      // Verify authorization header was forwarded
      const headers = options.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-api-key');
    });

    it('should preserve request object as FastifyRequest instance during translation', async () => {
      // Setup: Configure mock to capture the request object structure
      
      mockFetch.mockImplementation(async () => {
        // This will fail on unfixed code because headers is undefined
        // On fixed code, headers will be accessible
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({
            id: 'resp_456',
            object: 'response',
            model: 'gpt-4',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }]
          })
        };
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send request that triggers translation
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'authorization': 'Bearer test-key',
          'x-test-header': 'test-value'
        },
        payload: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test message' }]
        }
      });

      // Assert: On unfixed code, this will be 503 with TypeError
      // On fixed code, this will be 200 with successful response
      expect(response.statusCode).toBe(200);
      
      // Verify fetch was called successfully (confirms headers were accessible)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should preserve custom headers when translating to Response API', async () => {
      // Setup: Mock upstream API
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_789',
          object: 'response',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send request with multiple custom headers
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'authorization': 'Bearer custom-api-key',
          'x-request-id': 'req-12345',
          'x-organization': 'test-org',
          'user-agent': 'test-client/1.0'
        },
        payload: {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' }
          ]
        }
      });

      // Assert: Verify successful response (fails on unfixed code with 503)
      expect(response.statusCode).toBe(200);

      // Verify all custom headers were forwarded
      expect(mockFetch).toHaveBeenCalled();
      const fetchOptions = mockFetch.mock.calls[0][1];
      const headers = fetchOptions.headers as Headers;
      
      expect(headers.get('authorization')).toBe('Bearer custom-api-key');
      expect(headers.get('x-request-id')).toBe('req-12345');
      expect(headers.get('x-organization')).toBe('test-org');
      expect(headers.get('user-agent')).toBe('test-client/1.0');
    });

    it('should handle translation with empty headers object', async () => {
      // Setup: Mock upstream
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_empty',
          object: 'response',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send request with minimal headers
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }]
        }
      });

      // Assert: Should succeed even with minimal headers
      // On unfixed code: 503 error (headers is undefined)
      // On fixed code: 200 success
      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Bug Condition Context - Verify bug only affects translation scenario', () => {
    it('should NOT exhibit bug for pass-through requests (no translation)', async () => {
      // Setup: Mock upstream for pass-through
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_123',
          object: 'chat.completion',
          model: 'gpt-3.5-turbo',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Pass-through OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send request for model mapped to chat_completions (pass-through, no translation)
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'authorization': 'Bearer test-key'
        },
        payload: {
          model: 'gpt-3.5-turbo', // Mapped to chat_completions (pass-through)
          messages: [{ role: 'user', content: 'Hello' }]
        }
      });

      // Assert: Pass-through should work correctly (bug does NOT affect this path)
      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      
      // Verify correct endpoint was called (chat/completions, not responses)
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toBe('http://mock-openai-api.local/v1/chat/completions');
    });
  });
});

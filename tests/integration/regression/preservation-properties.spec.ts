import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createRoutingHandler } from '../../../src/handlers/routing.handler.js';
import type { AdapterConfig, ApiType } from '../../../src/config/types.js';
import fc from 'fast-check';

/**
 * Preservation Property Tests
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * These tests verify that for all inputs where the bug condition does NOT hold,
 * the routing handler produces the expected behavior. This establishes a baseline
 * of correct behavior that must be preserved after implementing the fix.
 * 
 * **Property 2: Preservation - Non-Translation Request Behavior**
 * 
 * For any request that does NOT require chat-to-response translation
 * (isBugCondition returns false), the routing handler SHALL produce the expected
 * behavior, preserving all existing functionality for:
 * - Pass-through requests (model mapped to chat_completions)
 * - Response API requests to /v1/responses endpoint
 * - Validation error handling
 * - Translation logic correctness
 * 
 * **IMPORTANT**: These tests run on UNFIXED code to observe baseline behavior.
 * They are EXPECTED TO PASS, confirming the behaviors we must preserve.
 */
describe('Preservation Property Tests - Non-Translation Scenarios', () => {
  let fastify: FastifyInstance;
  let mockFetch: ReturnType<typeof vi.fn>;

  const testModelMapping: Record<string, ApiType> = {
    'gpt-4': 'response',
    'gpt-4-turbo': 'response',
    'gpt-3.5-turbo': 'chat_completions',
    'gpt-3.5-turbo-16k': 'chat_completions',
    'claude-3': 'chat_completions'
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

  describe('Property 2.1: Pass-Through Request Preservation', () => {
    /**
     * Requirement 3.1: Pass-through requests (model mapped to chat_completions)
     * must continue to work without translation
     */
    it('should preserve pass-through behavior for chat_completions models', async () => {
      // Setup: Mock successful upstream response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'chatcmpl_passthrough',
          object: 'chat.completion',
          model: 'gpt-3.5-turbo',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Pass-through OK' }, finish_reason: 'stop' }]
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      // Act: Send request for model mapped to chat_completions (pass-through)
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          'authorization': 'Bearer test-key',
          'x-custom-header': 'custom-value'
        },
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      });

      // Assert: Pass-through should work correctly
      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify correct endpoint was called
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toBe('http://mock-openai-api.local/v1/chat/completions');

      // Verify headers were forwarded
      const fetchOptions = mockFetch.mock.calls[0][1];
      const headers = fetchOptions.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-key');
      expect(headers.get('x-custom-header')).toBe('custom-value');
    });

    it('should preserve headers for all pass-through chat_completions requests', async () => {
      // Property-based test: Generate random headers and verify they are preserved
      // Note: Headers API trims leading/trailing whitespace per HTTP spec
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            authToken: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0),
            customHeader: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            userAgent: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
          }),
          async (headers) => {
            // Setup fresh mock for each iteration
            mockFetch.mockResolvedValue({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              text: async () => JSON.stringify({
                id: 'test',
                object: 'chat.completion',
                model: 'gpt-3.5-turbo',
                choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
              })
            });

            const handler = createRoutingHandler(testConfig);
            const testFastify = Fastify({ logger: false });
            testFastify.post('/v1/chat/completions', handler);

            // Trim headers to match HTTP spec behavior (Headers API trims whitespace)
            const authValue = `Bearer ${headers.authToken}`.trim();
            const customValue = headers.customHeader.trim();
            const userAgentValue = headers.userAgent.trim();

            const response = await testFastify.inject({
              method: 'POST',
              url: '/v1/chat/completions',
              headers: {
                'authorization': authValue,
                'x-custom': customValue,
                'user-agent': userAgentValue
              },
              payload: {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Test' }]
              }
            });

            await testFastify.close();

            // Verify headers were preserved
            expect(response.statusCode).toBe(200);
            expect(mockFetch).toHaveBeenCalled();

            const fetchOptions = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1];
            const forwardedHeaders = fetchOptions.headers as Headers;
            expect(forwardedHeaders.get('authorization')).toBe(authValue);
            expect(forwardedHeaders.get('x-custom')).toBe(customValue);
            expect(forwardedHeaders.get('user-agent')).toBe(userAgentValue);

            mockFetch.mockClear();
          }
        ),
        { numRuns: 20 } // Run 20 random test cases
      );
    });

    it('should preserve pass-through for multiple chat_completions models', async () => {
      // Test all models mapped to chat_completions
      const chatCompletionModels = Object.entries(testModelMapping)
        .filter(([_, apiType]) => apiType === 'chat_completions')
        .map(([model]) => model);

      for (const model of chatCompletionModels) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({
            id: 'test',
            object: 'chat.completion',
            model,
            choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
          })
        });

        const handler = createRoutingHandler(testConfig);
        const testFastify = Fastify({ logger: false });
        testFastify.post('/v1/chat/completions', handler);

        const response = await testFastify.inject({
          method: 'POST',
          url: '/v1/chat/completions',
          headers: { 'authorization': 'Bearer test' },
          payload: {
            model,
            messages: [{ role: 'user', content: 'Test' }]
          }
        });

        await testFastify.close();

        expect(response.statusCode).toBe(200);
        expect(mockFetch).toHaveBeenCalled();

        mockFetch.mockClear();
      }
    });
  });

  describe('Property 2.2: Response API Request Preservation', () => {
    /**
     * Requirement 3.2: Response API requests to /v1/responses must continue
     * to process according to model mapping configuration
     */
    it('should preserve /v1/responses endpoint behavior for response API models', async () => {
      // Setup: Mock successful upstream response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({
          id: 'resp_test',
          object: 'response',
          model: 'gpt-4',
          result: 'Response API OK'
        })
      });

      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      // Act: Send request to /v1/responses for model mapped to response API
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'authorization': 'Bearer test-key',
          'content-type': 'application/json'
        },
        payload: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      });

      // Assert: Response API request should work correctly
      expect(response.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify correct endpoint was called
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toBe('http://mock-openai-api.local/v1/responses');

      // Verify headers were forwarded
      const fetchOptions = mockFetch.mock.calls[0][1];
      const headers = fetchOptions.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-key');
    });

    it('should preserve /v1/responses behavior for all response API models', async () => {
      // Test all models mapped to response API
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
            messages: [{ role: 'user', content: 'Test' }]
          }
        });

        await testFastify.close();

        expect(response.statusCode).toBe(200);
        expect(mockFetch).toHaveBeenCalled();

        // Verify correct endpoint
        const fetchUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
        expect(fetchUrl).toBe('http://mock-openai-api.local/v1/responses');

        mockFetch.mockClear();
      }
    });
  });

  describe('Property 2.3: Validation Error Preservation', () => {
    /**
     * Requirement 3.3: Translation validation failures must continue to
     * return appropriate 400 error responses
     */
    it('should preserve validation error for unknown model', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'unknown-model-xyz',
          messages: [{ role: 'user', content: 'Test' }]
        }
      });

      // Assert: Should return 400 validation error
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('type');
      expect(body.error.type).toBe('unknown_model');
      expect(body).toHaveProperty('requestId');
    });

    it('should preserve validation error for missing model field', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/chat/completions', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'Test' }]
        }
      });

      // Assert: Should return 400 validation error
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('invalid_model_field');
    });

    it('should preserve validation error for empty model field', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: '',
          messages: []
        }
      });

      // Assert: Should return 400 validation error
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('invalid_model_field');
    });

    it('should preserve JSON depth validation errors', async () => {
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 3
      };

      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/chat/completions', handler);

      // Create deeply nested JSON (depth > 3)
      const deepPayload = {
        model: 'gpt-3.5-turbo',
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
        url: '/v1/chat/completions',
        payload: deepPayload
      });

      // Assert: Should return 400 validation error
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('json_depth_exceeded');
    });

    it('should preserve validation error structure across multiple error types', async () => {
      // Property-based test: Verify all validation errors have consistent structure
      const errorScenarios = [
        {
          name: 'unknown_model',
          payload: { model: 'invalid-model', messages: [] }
        },
        {
          name: 'invalid_model_field',
          payload: { messages: [] }
        },
        {
          name: 'empty_model',
          payload: { model: '', messages: [] }
        }
      ];

      for (const scenario of errorScenarios) {
        const handler = createRoutingHandler(testConfig);
        const testFastify = Fastify({ logger: false });
        testFastify.post('/v1/chat/completions', handler);

        const response = await testFastify.inject({
          method: 'POST',
          url: '/v1/chat/completions',
          payload: scenario.payload
        });

        await testFastify.close();

        // Assert: All validation errors should have consistent structure
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('type');
        expect(body.error).toHaveProperty('message');
        expect(body.error).toHaveProperty('source');
        expect(body).toHaveProperty('requestId');
        expect(typeof body.error.type).toBe('string');
        expect(typeof body.error.message).toBe('string');
        expect(typeof body.requestId).toBe('string');
      }
    });
  });

  describe('Property 2.4: Translation Logic Preservation', () => {
    /**
     * Requirement 3.4: Translation logic itself (field mapping) must continue
     * to work correctly
     * 
     * Note: This tests the translation logic in isolation, not the full
     * request flow (which is affected by the bug)
     */
    it('should preserve translation logic for chat-to-response field mapping', async () => {
      // Import translation handler directly to test logic in isolation
      const { handleChatToResponseTranslation } = await import('../../../src/handlers/translation.handler.js');

      // Test translation logic with various inputs
      // Note: Chat Completions 'messages' field maps to Response API 'input' field
      const testCases = [
        {
          input: {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7
          },
          expectedFields: ['model', 'input', 'temperature'] // messages → input
        },
        {
          input: {
            model: 'gpt-4-turbo',
            messages: [
              { role: 'system', content: 'You are helpful' },
              { role: 'user', content: 'Hi' }
            ],
            max_tokens: 100
          },
          expectedFields: ['model', 'input', 'max_output_tokens'] // messages → input, max_tokens → max_output_tokens
        }
      ];

      for (const testCase of testCases) {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          child: vi.fn(() => mockLogger),
          trace: vi.fn(),
          fatal: vi.fn()
        };

        const result = handleChatToResponseTranslation(
          mockLogger,
          'test-request-id',
          testCase.input
        );

        // Assert: Translation should succeed
        expect(result.success).toBe(true);
        if (result.success) {
          // Verify expected fields are present in translated output
          for (const field of testCase.expectedFields) {
            expect(result.translated).toHaveProperty(field);
          }
        }
      }
    });

    it('should preserve translation validation for invalid inputs', async () => {
      const { handleChatToResponseTranslation } = await import('../../../src/handlers/translation.handler.js');

      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(() => mockLogger),
        trace: vi.fn(),
        fatal: vi.fn()
      };

      // Test with invalid input (missing messages)
      const result = handleChatToResponseTranslation(
        mockLogger,
        'test-request-id',
        { model: 'gpt-4' } // Missing messages field
      );

      // Assert: Translation should fail with appropriate error
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Property 2.5: Cross-Scenario Preservation', () => {
    /**
     * Verify that preservation holds across combinations of scenarios
     */
    it('should preserve behavior for pass-through with various payload structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            temperature: fc.double({ min: 0, max: 2, noNaN: true }),
            maxTokens: fc.integer({ min: 1, max: 4000 }),
            topP: fc.double({ min: 0, max: 1, noNaN: true })
          }),
          async (params) => {
            mockFetch.mockResolvedValue({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              text: async () => JSON.stringify({
                id: 'test',
                object: 'chat.completion',
                model: 'gpt-3.5-turbo',
                choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }]
              })
            });

            const handler = createRoutingHandler(testConfig);
            const testFastify = Fastify({ logger: false });
            testFastify.post('/v1/chat/completions', handler);

            const response = await testFastify.inject({
              method: 'POST',
              url: '/v1/chat/completions',
              headers: { 'authorization': 'Bearer test' },
              payload: {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Test' }],
                temperature: params.temperature,
                max_tokens: params.maxTokens,
                top_p: params.topP
              }
            });

            await testFastify.close();

            // Verify pass-through works with various parameter combinations
            expect(response.statusCode).toBe(200);
            expect(mockFetch).toHaveBeenCalled();

            mockFetch.mockClear();
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should preserve 404 error for unknown endpoints', async () => {
      const handler = createRoutingHandler(testConfig);
      fastify.post('/v1/unknown', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/unknown',
        payload: {
          model: 'gpt-4',
          messages: []
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });
});

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { buildServer } from '../../src/index.js';
import { createRoutingHandler } from '../../src/handlers/routing.handler.js';
import type { AdapterConfig } from '../../src/config/types.js';

describe('Validation Integration - Full Flow', () => {
  const testModelMapping = {
    'gpt-4': 'response',
    'gpt-4-turbo': 'response',
    'gpt-3.5-turbo': 'chat_completions',
    'gpt-3.5-turbo-16k': 'chat_completions',
    'gpt-4o': 'response',
    'gpt-4o-mini': 'response'
  };

  const testConfig: AdapterConfig = {
    targetUrl: 'http://localhost:3000',
    modelMappingFile: './config/model-mapping.json',
    modelMapping: testModelMapping,
    upstreamTimeoutSeconds: 60,
    maxConcurrentConnections: 1000,
    maxRequestSizeBytes: 10 * 1024 * 1024, // 10MB
    maxJsonDepth: 100
  };

  describe('Validation error responses', () => {
    it('should return correct error format for unknown model', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'unknown-model',
          messages: []
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('type');
      expect(body.error).toHaveProperty('message');
      expect(body.error).toHaveProperty('source');
      expect(body).toHaveProperty('requestId');
      expect(body.error.type).toBe('unknown_model');
      expect(body.error.source).toBe('adapter_error');
    });

    it('should return invalid_model_field when model is missing', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);

      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          messages: []
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('invalid_model_field');
      expect(body.error.source).toBe('adapter_error');
    });

    it('should include model name in unknown model error message', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-99',
          messages: []
        }
      });

      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('gpt-99');
    });
  });

  describe('Valid requests pass through validation', () => {
    it('should accept known models without validation errors', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          messages: []
        }
      });

      // Should NOT be a validation error (may be 501 for translation not implemented)
      expect(response.statusCode).not.toBe(400);
    });

    it('should accept chat/completions with valid model', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/chat/completions', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'hello' }]
        }
      });

      expect(response.statusCode).not.toBe(400);
    });
  });

  describe('JSON depth validation in routing context', () => {
    it('should reject deeply nested JSON', async () => {
      const fastify = Fastify({ logger: false });
      
      // Create config with small depth limit for testing
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 3
      };
      
      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/responses', handler);

      // Create deeply nested JSON (depth > 3)
      const deepPayload = {
        model: 'gpt-4',
        a: {
          b: {
            c: {
              d: 'too deep'
            }
          }
        }
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: deepPayload
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('json_depth_exceeded');
    });

    it('should accept JSON within depth limit', async () => {
      const fastify = Fastify({ logger: false });
      
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 5
      };
      
      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/responses', handler);

      // Create JSON with depth = 4 (within limit of 5)
      const validPayload = {
        model: 'gpt-4',
        a: {
          b: {
            c: {
              d: 'within limit'
            }
          }
        }
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: validPayload
      });

      expect(response.statusCode).not.toBe(400);
    });
  });

  describe('Validation response structure', () => {
    it('should include requestId in validation error response', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'not-found-model',
          messages: []
        }
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('requestId');
      expect(typeof body.requestId).toBe('string');
      expect(body.requestId.length).toBeGreaterThan(0);
    });

    it('should return consistent JSON structure for all error types', async () => {
      const fastify = Fastify({ logger: false });
      
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 1
      };
      
      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/responses', handler);

      const responseDepthError = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          a: { b: 'too deep' }
        }
      });

      const bodyDepth = JSON.parse(responseDepthError.body);
      
      // Check error structure
      expect(bodyDepth).toHaveProperty('error.type');
      expect(bodyDepth).toHaveProperty('error.message');
      expect(bodyDepth).toHaveProperty('error.source');
      expect(bodyDepth).toHaveProperty('requestId');

      // Check types
      expect(typeof bodyDepth.error.type).toBe('string');
      expect(typeof bodyDepth.error.message).toBe('string');
      expect(typeof bodyDepth.error.source).toBe('string');
      expect(typeof bodyDepth.requestId).toBe('string');
    });
  });

  describe('Multiple validation layers', () => {
    it('should catch unknown model even with valid depth', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'unknown-model',
          data: {
            nested: {
              structure: {
                here: 'value'
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('unknown_model');
    });

    it('should validate depth before checking model in large payloads', async () => {
      const fastify = Fastify({ logger: false });
      
      const smallDepthConfig: AdapterConfig = {
        ...testConfig,
        maxJsonDepth: 2
      };
      
      const handler = createRoutingHandler(smallDepthConfig);
      fastify.post('/v1/responses', handler);

      // Both depth and model invalid - depth should trigger first
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'unknown-model',
          a: {
            b: {
              c: 'too deep'
            }
          }
        }
      });

      const body = JSON.parse(response.body);
      // Depth validation happens before model validation in routing handler
      expect(body.error.type).toBe('json_depth_exceeded');
    });
  });

  describe('Payload size validation integration', () => {
    it('should have maxRequestSizeBytes configured', () => {
      expect(testConfig.maxRequestSizeBytes).toBe(10 * 1024 * 1024);
    });

    it('should reject payloads exceeding bodyLimit', async () => {
      const smallLimitConfig: AdapterConfig = {
        ...testConfig,
        maxRequestSizeBytes: 1 * 1024 * 1024
      };

      const app = buildServer({ config: smallLimitConfig, logger: false });
      const largePayload = {
        model: 'gpt-4',
        data: 'x'.repeat(1024 * 1024 + 200)
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: largePayload
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe('payload_too_large');
      expect(body.error.source).toBe('adapter_error');

      await app.close();
    });
  });

  describe('Real-world request scenarios', () => {
    it('should accept typical chat completion request', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/chat/completions', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello!' }
          ],
          temperature: 0.7,
          max_tokens: 100
        }
      });

      expect(response.statusCode).not.toBe(400);
    });

    it('should accept response format request', async () => {
      const fastify = Fastify({ logger: false });
      const handler = createRoutingHandler(testConfig);
      
      fastify.post('/v1/responses', handler);

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          prompt: 'Hello',
          max_tokens: 100
        }
      });

      expect(response.statusCode).not.toBe(400);
    });
  });
});

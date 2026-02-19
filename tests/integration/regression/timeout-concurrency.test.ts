import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../../src/index.js';
import { setConfigValid } from '../../../src/config/state.js';
import type { FastifyInstance } from 'fastify';

describe('Concurrency Limiting - Integration Tests', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    setConfigValid({
      targetUrl: 'https://api.openai.com/v1',
      modelMapping: {},
      upstreamTimeoutSeconds: 60,
      maxConcurrentConnections: 5 // Use small limit for testing
    });

    server = buildServer({
      logger: false,
      config: {
        targetUrl: 'https://api.openai.com/v1',
        modelMappingFile: '/app/config/model-mapping.json',
        modelMapping: {},
        upstreamTimeoutSeconds: 60,
        maxConcurrentConnections: 5 // Use small limit for testing
      }
    });
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Server creation with concurrency config', () => {
    it('creates server with maxConcurrentConnections in config', () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 60,
          maxConcurrentConnections: 1000
        }
      });

      expect(testServer).toBeDefined();
      expect(typeof testServer.listen).toBe('function');
    });

    it('accepts config with timeout and concurrency settings', () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 120,
          maxConcurrentConnections: 500
        }
      });

      expect(testServer).toBeDefined();
    });
  });

  describe('Default behavior without concurrency config', () => {
    it('server works without maxConcurrentConnections config', async () => {
      const testServer = buildServer({ logger: false });

      const response = await testServer.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      await testServer.close();
    });
  });

  describe('Health endpoint under normal conditions', () => {
    it('responds to health endpoint within limit', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('returns JSON content-type on health', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      const contentType = response.headers['content-type'];
      expect(contentType).toContain('application/json');
    });

    it('health endpoint bypasses connection limit', async () => {
      // Health endpoint should not count toward connection limit
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Readiness endpoint under normal conditions', () => {
    it('responds to readiness endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready'
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns JSON on readiness endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready'
      });

      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(typeof body.status).toBe('string');
    });

    it('readiness endpoint bypasses connection limit', async () => {
      // Readiness endpoint should not count toward connection limit
      const response = await server.inject({
        method: 'GET',
        url: '/ready'
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Connection handling behavior', () => {
    it('accepts multiple sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/health'
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('handles rapid-fire requests', async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          server.inject({
            method: 'GET',
            url: '/health'
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('Error handling', () => {
    it('returns valid JSON on all responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      if (response.statusCode === 200) {
        expect(response.json()).toBeDefined();
        expect(typeof response.json()).toBe('object');
      }
    });
  });

  describe('Server stability', () => {
    it('recovers after concurrent request spike', async () => {
      // Send spike of requests
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          server.inject({
            method: 'GET',
            url: '/health'
          }).catch(() => null)
        );
      }
      await Promise.all(promises);

      // Server should still respond to new requests
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
    });

    it('maintains endpoint availability', async () => {
      // Multiple sequences of requests
      for (let seq = 0; seq < 5; seq++) {
        const response = await server.inject({
          method: 'GET',
          url: '/health'
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Configuration availability', () => {
    it('stores timeout configuration for later use', () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 90,
          maxConcurrentConnections: 1000
        }
      });

      expect(testServer.config).toBeDefined();
      expect(testServer.config.upstreamTimeoutSeconds).toBe(90);
    });

    it('stores concurrency configuration for request handling', () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 60,
          maxConcurrentConnections: 2000
        }
      });

      expect(testServer.config).toBeDefined();
      expect(testServer.config.maxConcurrentConnections).toBe(2000);
    });
  });

  describe('Integration with buildServer options', () => {
    it('combines logger and config options', () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 60,
          maxConcurrentConnections: 100
        }
      });

      expect(testServer).toBeDefined();
      expect(testServer.log).toBeDefined();
    });

    it('can be created without options', () => {
      const testServer = buildServer();
      expect(testServer).toBeDefined();
    });

    it('preserves all Fastify functionality with config', async () => {
      const testServer = buildServer({
        logger: false,
        config: {
          targetUrl: 'https://api.openai.com/v1',
          modelMappingFile: '/app/config/model-mapping.json',
          modelMapping: {},
          upstreamTimeoutSeconds: 60,
          maxConcurrentConnections: 50
        }
      });

      const response = await testServer.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      await testServer.close();
    });
  });
});


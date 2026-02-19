import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../../src/index.js';
import { setConfigValid } from '../../../src/config/state.js';
import type { FastifyInstance } from 'fastify';

describe('Concurrency Limiting - AC3 Verification', () => {
  let server: FastifyInstance;
  const concurrencyLimit = 3; // Small limit for testing

  beforeEach(() => {
    setConfigValid({
      targetUrl: 'https://api.openai.com/v1',
      modelMapping: {},
      upstreamTimeoutSeconds: 60,
      maxConcurrentConnections: concurrencyLimit
    });

    server = buildServer({
      logger: false,
      config: {
        targetUrl: 'https://api.openai.com/v1',
        modelMappingFile: '/app/config/model-mapping.json',
        modelMapping: {},
        upstreamTimeoutSeconds: 60,
        maxConcurrentConnections: concurrencyLimit
      }
    });
  });

  afterEach(async () => {
    await server.close();
  });

  describe('AC3.1: Connection limit enforcement', () => {
    it('returns 503 when concurrent connections exceed limit', async () => {
      // Create an endpoint that holds the connection open
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill up connection pool with requests that take 100ms
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      // Small delay to ensure hooks have processed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Next request should get 503
      const blockedResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(blockedResponse.statusCode).toBe(503);

      // Wait for slow requests to complete
      await Promise.all(slowRequests);
    });

    it('accepts new requests after connections drop below limit', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { ok: true };
      });

      // Fill connection pool
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(slowRequests);
      results.forEach(res => expect(res.statusCode).toBe(200));

      // New request should succeed after pool drains
      const newResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(newResponse.statusCode).toBe(200);
    });
  });

  describe('AC3.2: 503 response includes clear error message', () => {
    it('includes "Maximum concurrent connections exceeded" message', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      const blockedResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(blockedResponse.statusCode).toBe(503);
      const body = blockedResponse.json();
      expect(body.message).toBe('Maximum concurrent connections exceeded');
      expect(body.error).toBe('Service Unavailable');

      await Promise.all(slowRequests);
    });
  });

  describe('AC3.3: 503 response includes request ID', () => {
    it('includes requestId field in 503 response', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      const blockedResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(blockedResponse.statusCode).toBe(503);
      const body = blockedResponse.json();
      expect(body).toHaveProperty('requestId');
      expect(typeof body.requestId).toBe('string');
      expect(body.requestId.length).toBeGreaterThan(0);

      await Promise.all(slowRequests);
    });

    it('request ID is unique for each 503 response', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get multiple 503 responses
      const blockedResponse1 = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });
      const blockedResponse2 = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      const body1 = blockedResponse1.json();
      const body2 = blockedResponse2.json();

      expect(body1.requestId).not.toBe(body2.requestId);

      await Promise.all(slowRequests);
    });
  });

  describe('AC3.4: Health and readiness endpoints bypass limit', () => {
    it('health endpoint does not count toward connection limit', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool with regular requests
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Health endpoint should still work
      const healthResponse = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json()).toEqual({ status: 'ok' });

      await Promise.all(slowRequests);
    });

    it('readiness endpoint does not count toward connection limit', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool with regular requests
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Readiness endpoint should still work
      const readyResponse = await server.inject({
        method: 'GET',
        url: '/ready'
      });

      expect(readyResponse.statusCode).toBe(200);

      await Promise.all(slowRequests);
    });

    it('regular request gets 503 while health returns 200', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill connection pool
      const slowRequests = [];
      for (let i = 0; i < concurrencyLimit; i++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Test both at same time
      const [blockedResponse, healthResponse] = await Promise.all([
        server.inject({ method: 'GET', url: '/test-endpoint' }),
        server.inject({ method: 'GET', url: '/health' })
      ]);

      expect(blockedResponse.statusCode).toBe(503);
      expect(healthResponse.statusCode).toBe(200);

      await Promise.all(slowRequests);
    });
  });

  describe('Edge cases and recovery', () => {
    it('handles rapid connection cycling', async () => {
      server.get('/test-endpoint', async () => {
        return { ok: true };
      });

      // Make many rapid requests
      for (let batch = 0; batch < 10; batch++) {
        const requests = [];
        for (let i = 0; i < concurrencyLimit + 2; i++) {
          requests.push(
            server.inject({
              method: 'GET',
              url: '/test-endpoint'
            })
          );
        }
        await Promise.all(requests);
      }

      // Final request should still work
      const finalResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(finalResponse.statusCode).toBe(200);
    });

    it('connection count resets correctly after 503 responses', async () => {
      server.get('/test-endpoint', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true };
      });

      // Fill pool
      const slowRequests = [];
      for (let j = 0; j < concurrencyLimit; j++) {
        slowRequests.push(
          server.inject({
            method: 'GET',
            url: '/test-endpoint'
          })
        );
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      // Get 503
      const blocked = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });
      expect(blocked.statusCode).toBe(503);

      // Wait for all requests to complete
      await Promise.all(slowRequests);
      await new Promise(resolve => setTimeout(resolve, 20));

      // New request should succeed now
      const finalResponse = await server.inject({
        method: 'GET',
        url: '/test-endpoint'
      });

      expect(finalResponse.statusCode).toBe(200);
    });
  });
});

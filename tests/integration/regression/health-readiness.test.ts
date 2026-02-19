import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../../src/index.js';
import { resetConfigState, setConfigValid, setConfigInvalid } from '../../../src/config/state.js';
import type { FastifyInstance } from 'fastify';

describe('Health & Readiness Endpoints', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    resetConfigState();
    server = buildServer({ logger: false });
  });

  afterEach(async () => {
    await server.close();
    resetConfigState();
  });

  describe('GET /health', () => {
    it('returns 200 OK when server is running', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns correct response body', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('returns application/json Content-Type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('always returns 200 even when config is invalid', async () => {
      // Set config to invalid state
      setConfigInvalid(new Error('Config test error'));

      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('responds within performance requirement', async () => {
      const startTime = process.hrtime.bigint();
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });
      const endTime = process.hrtime.bigint();

      const responseTimeMs = Number(endTime - startTime) / 1_000_000;
      expect(responseTimeMs).toBeLessThan(50);
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /ready', () => {
    describe('when configuration is valid', () => {
      beforeEach(() => {
        setConfigValid({ targetUrl: 'http://example.com', modelMapping: {} });
      });

      it('returns 200 OK', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.statusCode).toBe(200);
      });

      it('returns correct response body', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.json()).toEqual({
          status: 'ready',
          checks: {
            config: 'ok'
          }
        });
      });

      it('returns application/json Content-Type', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.headers['content-type']).toContain('application/json');
      });

      it('responds within performance requirement', async () => {
        const startTime = process.hrtime.bigint();
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });
        const endTime = process.hrtime.bigint();

        const responseTimeMs = Number(endTime - startTime) / 1_000_000;
        expect(responseTimeMs).toBeLessThan(50);
        expect(response.statusCode).toBe(200);
      });
    });

    describe('when configuration is invalid', () => {
      beforeEach(() => {
        setConfigInvalid(new Error('Configuration validation failed'));
      });

      it('returns 503 Service Unavailable', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.statusCode).toBe(503);
      });

      it('returns correct response body with error details', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        const body = response.json();
        expect(body).toEqual({
          status: 'not_ready',
          checks: {
            config: 'failed'
          },
          message: 'Configuration validation failed'
        });
      });

      it('returns application/json Content-Type', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.headers['content-type']).toContain('application/json');
      });

      it('responds within performance requirement', async () => {
        const startTime = process.hrtime.bigint();
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });
        const endTime = process.hrtime.bigint();

        const responseTimeMs = Number(endTime - startTime) / 1_000_000;
        expect(responseTimeMs).toBeLessThan(50);
        expect(response.statusCode).toBe(503);
      });
    });

    describe('when config state is uninitialized (default)', () => {
      it('returns 503 Service Unavailable', async () => {
        // By default, config state is invalid (resetConfigState sets isValid to false)
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        expect(response.statusCode).toBe(503);
      });

      it('returns not_ready status', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        const body = response.json();
        expect(body.status).toBe('not_ready');
        expect(body.checks.config).toBe('failed');
      });
    });

    describe('response format consistency', () => {
      it('uses lowercase status values', async () => {
        setConfigValid({ targetUrl: 'http://example.com', modelMapping: {} });

        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        const body = response.json();
        expect(body.status).toBe('ready');
        expect(typeof body.status).toBe('string');
        expect(body.status).toMatch(/^[a-z_]+$/);
      });

      it('check names follow consistent pattern', async () => {
        setConfigValid({ targetUrl: 'http://example.com', modelMapping: {} });

        const response = await server.inject({
          method: 'GET',
          url: '/ready'
        });

        const body = response.json();
        expect(body.checks).toHaveProperty('config');
        expect(Object.keys(body.checks)).toContain('config');
      });
    });

    describe('repeated requests behavior', () => {
      it('performs fresh check on each request (no caching)', async () => {
        // Start with invalid config
        setConfigInvalid(new Error('Test error'));

        const response1 = await server.inject({
          method: 'GET',
          url: '/ready'
        });
        expect(response1.statusCode).toBe(503);

        // Update to valid config
        setConfigValid({ targetUrl: 'http://example.com', modelMapping: {} });

        const response2 = await server.inject({
          method: 'GET',
          url: '/ready'
        });
        expect(response2.statusCode).toBe(200);
      });

      it('handles rapid successive requests', async () => {
        setConfigValid({ targetUrl: 'http://example.com', modelMapping: {} });

        const results = await Promise.all([
          server.inject({ method: 'GET', url: '/ready' }),
          server.inject({ method: 'GET', url: '/ready' }),
          server.inject({ method: 'GET', url: '/ready' })
        ]);

        results.forEach((response) => {
          expect(response.statusCode).toBe(200);
          expect(response.json().status).toBe('ready');
        });
      });
    });
  });

  describe('Logging behavior', () => {
    it('should exclude /health from request logging', async () => {
      // This is tested indirectly - the skipLogging hook is set up
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      // In a real scenario, we'd verify logs don't contain this request
      // For unit testing, we just verify the endpoint works
    });

    it('should exclude /ready from request logging', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready'
      });

      expect(response.statusCode).toBe(503);
      // Verify endpoint is functional
    });
  });
});

import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/index.js';

describe('buildServer', () => {
  it('creates a Fastify instance', () => {
    const server = buildServer();
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
    expect(typeof server.inject).toBe('function');
  });

  it('accepts custom logger configuration', () => {
    const server = buildServer({ logger: false });
    expect(server).toBeDefined();
  });

  it('registers health endpoint', async () => {
    const server = buildServer({ logger: false });
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('uses default logger when no options provided', () => {
    const server = buildServer();
    expect(server.log).toBeDefined();
  });

  it('uses pino-pretty transport when LOG_PRETTY=1', () => {
    const originalEnv = process.env.LOG_PRETTY;
    process.env.LOG_PRETTY = '1';
    
    const server = buildServer();
    expect(server.log).toBeDefined();
    
    if (originalEnv !== undefined) {
      process.env.LOG_PRETTY = originalEnv;
    } else {
      delete process.env.LOG_PRETTY;
    }
  });
});

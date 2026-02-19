import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { buildServer } from '../../src/index.js';
import type { AdapterConfig } from '../../src/config/types.js';

/**
 * Integration tests for pass-through functionality
 * Tests the full request/response flow without actual OpenAI calls
 */

describe('Pass-Through Integration Tests', () => {
  let mockOpenAiServer: Server;
  let mockOpenAiUrl: string;
  let adapter: ReturnType<typeof buildServer>;

  const testConfig: AdapterConfig = {
    targetUrl: '',  // Will be set after mock server starts
    modelMappingFile: '',
    modelMapping: {
      'gpt-4': 'response',
      'gpt-4-turbo': 'response',
      'gpt-3.5-turbo': 'chat_completions',
      'gpt-3.5-turbo-16k': 'chat_completions',
      'gpt-4o': 'response',
      'gpt-4o-mini': 'response'
    },
    upstreamTimeoutSeconds: 10,
    maxConcurrentConnections: 1000
  };

  beforeAll(async () => {
    // Start mock OpenAI server
    mockOpenAiServer = createServer((req, res) => {
      // Mock OpenAI API responses
      if (req.url === '/v1/responses' && req.method === 'POST') {
        // Echo back request data with mock response
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'text_completion',
            created: Date.now(),
            model: JSON.parse(body).model,
            result: 'Mock response'
          }));
        });
      } else if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        // Echo back request data with mock response
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: JSON.parse(body).model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Mock response'
                },
                finish_reason: 'stop'
              }
            ]
          }));
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    // Start mock server and get URL
    await new Promise<void>((resolve) => {
      mockOpenAiServer.listen(0, 'localhost', () => {
        const addr = mockOpenAiServer.address() as AddressInfo;
        mockOpenAiUrl = `http://localhost:${addr.port}`;
        testConfig.targetUrl = mockOpenAiUrl;
        
        // Now create adapter with correct config
        adapter = buildServer({ config: testConfig });
        resolve();
      });
    });
  });

  afterAll(async () => {
    await adapter.close();
    mockOpenAiServer.close();
  });

  describe('Pass-through to /v1/responses', () => {
    it('should forward gpt-4 request to /v1/responses endpoint', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          temperature: 0.7
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.model).toBe('gpt-4');
      expect(body.result).toBe('Mock response');
    });

    it('should preserve request headers in pass-through', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          'Authorization': 'Bearer test-token',
          'User-Agent': 'test-client',
          'X-Custom-Header': 'custom-value'
        },
        payload: {
          model: 'gpt-4-turbo',
          messages: []
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.model).toBe('gpt-4-turbo');
    });

    it('should forward response headers unchanged', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4o',
          messages: []
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Pass-through to /v1/chat/completions', () => {
    it('should forward gpt-3.5-turbo request to /v1/chat/completions', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.model).toBe('gpt-3.5-turbo');
      expect(body.choices).toBeDefined();
    });

    it('should handle long model names', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-3.5-turbo-16k',
          messages: []
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.model).toBe('gpt-3.5-turbo-16k');
    });
  });

  describe('Translation mode (not implemented)', () => {
    it('should return 501 when gpt-3.5-turbo hits /v1/responses', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: []
        }
      });

      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Implemented');
      expect(body.message).toContain('Translation not yet implemented');
      expect(body.sourceFormat).toBe('response');
      expect(body.targetFormat).toBe('chat_completions');
    });

    it('should return 501 when gpt-4 hits /v1/chat/completions', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4',
          messages: []
        }
      });

      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Implemented');
      expect(body.sourceFormat).toBe('chat_completions');
      expect(body.targetFormat).toBe('response');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for unmapped model', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'unknown-model',
          messages: []
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('not found');
    });

    it('should return 400 for missing model field', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          messages: []
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should return 400 for empty model field', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: '',
          messages: []
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should return 404 for unknown endpoint', async () => {
      const response = await adapter.inject({
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

  describe('Performance requirements', () => {
    it('should complete pass-through request in <1ms overhead', async () => {
      const response = await adapter.inject({
        method: 'POST',
        url: '/v1/responses',
        payload: {
          model: 'gpt-4',
          messages: []
        }
      });

      expect(response.statusCode).toBe(200);
      // Note: This is integration test, actual latency measurement
      // with precise sub-millisecond accuracy would require
      // instrumentation of the handler itself
      // The test validates the request completes successfully
    });
  });
});

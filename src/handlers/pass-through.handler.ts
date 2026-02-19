import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AdapterConfig } from '../config/types.js';

/**
 * Pass-through handler - forwards requests to OpenAI unchanged
 * Preserves all headers, body, and response data bit-for-bit
 */

export type PassThroughHandlerOptions = {
  config: AdapterConfig;
};

/**
 * Create a pass-through handler for the given endpoint
 * @param endpoint The endpoint path (e.g., "responses" or "chat/completions")
 * @param options Handler configuration
 * @returns Fastify handler function
 */
export function createPassThroughHandler(
  endpoint: string,
  options: PassThroughHandlerOptions
) {
  const { config } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Build upstream URL
      const upstreamUrl = `${config.targetUrl.replace(/\/$/, '')}/v1/${endpoint}`;

      // Forward headers (preserve all original headers except host/content-length/transfer-encoding)
      const forwardedHeaders = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        // Skip host header (will be set by fetch)
        if (key.toLowerCase() === 'host') {
          continue;
        }
        if (key.toLowerCase() === 'content-length' || key.toLowerCase() === 'transfer-encoding') {
          continue;
        }
        if (typeof value === 'string') {
          forwardedHeaders.set(key, value);
        }
      }

      // Create abort signal with timeout
      const timeoutMs = config.upstreamTimeoutSeconds * 1000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Forward request to OpenAI
        const upstreamResponse = await fetch(upstreamUrl, {
          method: request.method,
          headers: forwardedHeaders,
          body: request.method !== 'GET' && request.method !== 'HEAD'
            ? JSON.stringify(request.body)
            : undefined,
          signal: controller.signal
        });

        // Log pass-through request
        request.log.info({
          action: 'pass_through_request',
          endpoint,
          model: (request.body as Record<string, unknown>)?.model,
          status: upstreamResponse.status
        });

        // Read response body
        let responseBody: string;
        try {
          responseBody = await upstreamResponse.text();
        } catch (error) {
          request.log.error({
            action: 'response_body_read_error',
            error: error instanceof Error ? error.message : String(error),
            status: upstreamResponse.status
          });
          return reply.code(502).send({
            error: 'Bad Gateway',
            message: 'Failed to read OpenAI response'
          });
        }

        // Forward response headers
        upstreamResponse.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        // Forward status code and body unchanged
        return reply
          .code(upstreamResponse.status)
          .type(upstreamResponse.headers.get('content-type') || 'application/json')
          .send(responseBody);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        request.log.error({
          action: 'upstream_timeout',
          endpoint,
          timeout_seconds: config.upstreamTimeoutSeconds
        });
        return reply.code(504).send({
          error: 'Gateway Timeout',
          message: `OpenAI request timed out after ${config.upstreamTimeoutSeconds}s`
        });
      }

      // Handle connection errors
      const errorDetails = error instanceof Error 
        ? { 
            message: error.message, 
            name: error.name, 
            code: (error as NodeJS.ErrnoException)?.code,
            cause: (error as Error & { cause?: unknown })?.cause,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
          }
        : { error: String(error) };

      request.log.error({
        action: 'upstream_error',
        endpoint,
        targetUrl: config.targetUrl,
        upstream_url: `${config.targetUrl.replace(/\/$/, '')}/v1/${endpoint}`,
        ...errorDetails,
        error_source: 'openai_connection'
      });

      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Failed to communicate with OpenAI API',
        details: process.env.NODE_ENV === 'production' ? undefined : {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : undefined,
          targetUrl: config.targetUrl,
          upstreamUrl: `${config.targetUrl.replace(/\/$/, '')}/v1/${endpoint}`
        }
      });
    }
  };
}

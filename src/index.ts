import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { pathToFileURL } from 'node:url';
import type { AdapterConfig } from './config/types.js';
import { loadConfiguration } from './config/loader.js';
import { getHealth, getReadiness } from './handlers/health.js';
import { createRoutingHandler } from './handlers/routing.handler.js';
import { setConfigValid, setConfigInvalid } from './config/state.js';
import { formatValidationError } from './handlers/error-formatter.js';
import { ValidationError, VALIDATION_ERROR_TYPES, isValidationError } from './types/validation-errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AdapterConfig;
  }
}

export type BuildServerOptions = {
  logger?: FastifyServerOptions['logger'];
  config?: AdapterConfig;
};

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const logger: FastifyServerOptions['logger'] =
    options.logger !== undefined
      ? options.logger
      : process.env.LOG_PRETTY === '1'
        ? {
            level: 'info',
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true
              }
            }
          }
        : {
            level: 'info'
          };

  const app = Fastify({
    logger,
    bodyLimit: options.config?.maxRequestSizeBytes
  });

  if (options.config) {
    app.decorate('config', options.config);
  }

  // Register error handler for validation errors
  app.setErrorHandler((error, request, reply) => {
    if (isValidationError(error)) {
      return reply.status(400).send(formatValidationError(error, request.id));
    }

    if (
      app.config &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    ) {
      const maxRequestSizeMB = Math.round(app.config.maxRequestSizeBytes / (1024 * 1024));
      const validationError = new ValidationError(
        VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
        `Request payload exceeds maximum size of ${maxRequestSizeMB}MB`
      );

      return reply.status(400).send(formatValidationError(validationError, request.id));
    }

    // Let other errors be handled by default handler
    throw error;
  });
  let activeConnections = 0;
  const maxConnections = options.config?.maxConcurrentConnections ?? 1000;

  // Register hook to track connections and enforce limit
  app.addHook('onRequest', async (request, _reply) => {
    // Health and readiness endpoints bypass connection limit
    if (request.url === '/health' || request.url === '/ready') {
      return;
    }

    activeConnections++;

    if (activeConnections > maxConnections) {
      activeConnections--;
      void _reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Maximum concurrent connections exceeded',
        requestId: request.id
      });
      return;
    }
  });

  // Register hook to decrement connection count on response
  app.addHook('onResponse', async (request, _reply) => {
    if (request.url !== '/health' && request.url !== '/ready') {
      activeConnections--;
    }
  });

  // Register hook to exclude health/readiness from request logging
  // These endpoints are called frequently by orchestration platforms
  // and shouldn't clutter application logs
  app.addHook('onRequest', async (request, _reply) => {
    if (request.url === '/health' || request.url === '/ready') {
      request.log.level = 'silent';
    }
  });

  // Health endpoint - Kubernetes liveness probe
  // Always returns 200 if process is alive
  app.get('/health', getHealth);

  // Readiness endpoint - Kubernetes readiness probe
  // Returns 200 if ready to accept traffic, 503 otherwise
  app.get('/ready', getReadiness);

  // Register API endpoints with routing handler (if config is available)
  if (app.config) {
    const routingHandler = createRoutingHandler(app.config);
    app.post('/v1/responses', routingHandler);
    app.post('/v1/chat/completions', routingHandler);
  }

  return app;
}

export async function startServer(): Promise<void> {
  try {
    // Load and validate configuration
    const config = await loadConfiguration();
    
    console.log(JSON.stringify({ 
      level: 'info',
      msg: 'Configuration loaded successfully',
      targetUrl: config.targetUrl,
      modelCount: Object.keys(config.modelMapping).length,
      upstreamTimeoutSeconds: config.upstreamTimeoutSeconds,
      maxConcurrentConnections: config.maxConcurrentConnections,
      maxRequestSizeBytes: config.maxRequestSizeBytes,
      maxJsonDepth: config.maxJsonDepth
    }));

    // Set global config state to valid for readiness handler
    setConfigValid(config as unknown as Record<string, unknown>);

    const app = buildServer({ config });

    const port = Number.parseInt(process.env.PORT ?? '3000', 10);

    await app.listen({ port, host: '0.0.0.0' });
    app.log.info({ action: 'server_started', port });
  } catch (error) {
    // Set global config state to invalid for readiness handler
    setConfigInvalid(error instanceof Error ? error : new Error(String(error)));

    console.error(JSON.stringify({
      level: 'error',
      msg: 'Configuration validation failed',
      error: error instanceof Error ? error.message : String(error),
      action: 'server_start_failed'
    }));
    process.exit(1);
  }
}

const entryFile = process.argv[1];
if (entryFile) {
  const isMain = import.meta.url === pathToFileURL(entryFile).href;
  if (isMain) {
    void startServer();
  }
}

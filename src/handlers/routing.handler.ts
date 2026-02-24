import type { FastifyRequest, FastifyReply } from 'fastify';
import { Router } from '../routing/router.js';
import { ModelMapper } from '../routing/model-mapper.js';
import { createPassThroughHandler } from './pass-through.handler.js';
import { handleChatToResponseTranslation } from './translation.handler.js';
import type { AdapterConfig } from '../config/types.js';
import { validateJsonDepth } from '../validation/json-depth-validator.js';
import { isValidationError } from '../types/validation-errors.js';
import { formatValidationError } from './error-formatter.js';

/**
 * Routing handler - determines whether to use pass-through or translation
 * Entry point for both /v1/responses and /v1/chat/completions endpoints
 */

export function createRoutingHandler(config: AdapterConfig) {
  const modelMapper = new ModelMapper(config.modelMapping);
  const router = new Router(modelMapper);
  
  // Create pass-through handlers once for reuse
  const responsesHandler = createPassThroughHandler('responses', { config });
  const chatCompletionsHandler = createPassThroughHandler('chat/completions', { config });

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Step 1: Validate JSON depth (must happen after JSON parsing, before routing)
      validateJsonDepth(request.body, config.maxJsonDepth);

      // Determine endpoint from path
      let endpoint: string;
      let passThroughHandler: ReturnType<typeof createPassThroughHandler>;
      
      if (request.url.includes('/v1/responses')) {
        endpoint = 'responses';
        passThroughHandler = responsesHandler;
      } else if (request.url.includes('/v1/chat/completions')) {
        endpoint = 'chat/completions';
        passThroughHandler = chatCompletionsHandler;
      } else {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Unknown endpoint'
        });
      }

      // Step 2: Make routing decision (includes model validation)
      const routingResult = router.routingDecision(request.url, request.body);

      request.log.info({
        action: 'routing_decision',
        endpoint,
        model: routingResult.model,
        source_format: routingResult.sourceFormat,
        target_format: routingResult.targetFormat,
        decision: routingResult.decision
      });

      // Route based on decision
      if (routingResult.decision === 'pass-through') {
        // Forward to pass-through handler (reuse pre-created handler)
        return passThroughHandler(request, reply);
      } else {
        // Translation required - invoke translation handler for Chat→Response
        if (
          routingResult.sourceFormat === 'chat_completions' &&
          routingResult.targetFormat === 'response'
        ) {
          // Perform translation
          const translationResult = handleChatToResponseTranslation(
            request.log,
            request.id,
            request.body
          );

          if (!translationResult.success) {
            request.log.warn({
              action: 'translation_failed',
              endpoint,
              model: routingResult.model,
              error: translationResult.error
            });

            return reply.code(400).send({
              error: 'Translation Error',
              message: translationResult.error,
              requestId: request.id
            });
          }

          // Safety check: translated should be defined when success is true
          if (!translationResult.translated) {
            request.log.error({
              action: 'translation_invalid_state',
              endpoint,
              model: routingResult.model,
              message: 'Translation succeeded but translated is undefined'
            });

            return reply.code(500).send({
              error: 'Internal Server Error',
              message: 'Translation succeeded but no translated output',
              requestId: request.id
            });
          }

          // CRITICAL DEBUG LOG - THIS SHOULD ALWAYS APPEAR
          request.log.info({
            action: 'TRANSLATION_SUCCESS_CONFIRMED',
            endpoint,
            model: routingResult.model,
            message: 'Translation succeeded, about to process request'
          });

          // Log BEFORE modifying request
          request.log.info({
            action: 'before_body_modification',
            endpoint,
            model: routingResult.model,
            request_headers_before: request.headers !== undefined,
            request_type_before: request.constructor.name
          });

          // FIX: Directly modify request.body instead of creating a new object
          // This preserves the Fastify request object structure and all properties
          request.body = translationResult.translated;

          // Log AFTER modifying request
          request.log.info({
            action: 'after_body_modification',
            endpoint,
            model: routingResult.model,
            original_request_headers: request.headers !== undefined,
            request_type_after: request.constructor.name
          });

          // Forward to Response API endpoint (target format is 'response')
          // Use responsesHandler since we're translating to Response API format
          return responsesHandler(request, reply);
        } else {
          // Other translation directions not yet implemented
          request.log.warn({
            action: 'translation_not_implemented',
            endpoint,
            source: routingResult.sourceFormat,
            target: routingResult.targetFormat,
            message: `Translation from ${routingResult.sourceFormat} to ${routingResult.targetFormat} not yet implemented`
          });

          return reply.code(501).send({
            error: 'Not Implemented',
            message: `Translation from ${routingResult.sourceFormat} to ${routingResult.targetFormat} not yet implemented`,
            sourceFormat: routingResult.sourceFormat,
            targetFormat: routingResult.targetFormat
          });
        }
      }
    } catch (error) {
      // Handle validation/routing errors
      request.log.error({
        action: 'routing_error',
        error: error instanceof Error ? error.message : String(error)
      });

      // Handle ValidationError with standardized error format
      if (isValidationError(error)) {
        const errorResponse = formatValidationError(error, request.id);
        return reply.code(400).send(errorResponse);
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      return reply.code(400).send({
        error: 'Bad Request',
        message: errorMessage,
        requestId: request.id
      });
    }
  };
}

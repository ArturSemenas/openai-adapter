import type { ApiType } from '../config/types.js';
import { ModelMapper } from './model-mapper.js';
import { ValidationError, VALIDATION_ERROR_TYPES } from '../types/validation-errors.js';

export type RoutingDecision = 'pass-through' | 'translate';

export interface RoutingResult {
  decision: RoutingDecision;
  sourceFormat: ApiType;
  targetFormat: ApiType;
  model: string;
}

/**
 * Router - Determines routing path for requests
 * Detects if source format matches target format (pass-through) or needs translation
 */
export class Router {
  constructor(private readonly modelMapper: ModelMapper) {}

  /**
   * Detect source API format from endpoint path
   * @param path The HTTP request path
   * @returns The source API type
   * @throws Error if endpoint is not recognized
   */
  detectSourceFormat(path: string): ApiType {
    if (path.includes('/v1/responses')) {
      return 'response';
    }
    
    if (path.includes('/v1/chat/completions')) {
      return 'chat_completions';
    }
    
    throw new Error(`Unknown endpoint: ${path}`);
  }

  /**
   * Extract model name from request body
   * Works for both response and chat_completions formats
   * Both formats have model at request.body.model
   * @param body The request body
   * @returns The model name
   * @throws Error if model field is missing or invalid
   */
  extractModel(body: unknown): string {
    const invalidModelMessage = 'Model field is required and must be a non-empty string';

    if (typeof body !== 'object' || body === null) {
      throw new ValidationError(
        VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD,
        invalidModelMessage
      );
    }

    const bodyObj = body as Record<string, unknown>;
    const model = bodyObj.model;

    if (typeof model !== 'string' || model.length === 0) {
      throw new ValidationError(
        VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD,
        invalidModelMessage
      );
    }

    return model;
  }

  /**
   * Validate that a model exists in the mapping
   * @param model The model name to validate
   * @throws ValidationError if model is not in mapping
   */
  validateModel(model: string): void {
    if (!this.modelMapper.hasModel(model)) {
      throw new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        `Model '${model}' not found in configuration`
      );
    }
  }

  /**
   * Make routing decision for a request
   * @param path The HTTP request path
   * @param body The request body
   * @returns Routing result with decision and details
   * @throws Error if routing cannot be determined (invalid input)
   * @throws ValidationError if model is not in mapping
   */
  routingDecision(path: string, body: unknown): RoutingResult {
    // Detect source format from endpoint
    const sourceFormat = this.detectSourceFormat(path);

    // Extract model from body
    const model = this.extractModel(body);

    // Validate that model exists in mapping
    this.validateModel(model);

    // Look up target format for this model
    const targetFormat = this.modelMapper.getTargetApi(model);

    // Determine routing path
    const decision: RoutingDecision =
      sourceFormat === targetFormat ? 'pass-through' : 'translate';

    return {
      decision,
      sourceFormat,
      targetFormat,
      model
    };
  }
}

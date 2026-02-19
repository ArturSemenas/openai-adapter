import { describe, it, expect } from 'vitest';
import { Router } from '../../../src/routing/router.js';
import { ModelMapper } from '../../../src/routing/model-mapper.js';
import type { ModelMapping } from '../../../src/config/types.js';
import { ValidationError, VALIDATION_ERROR_TYPES } from '../../../src/types/validation-errors.js';

describe('Router', () => {
  const testMapping: ModelMapping = {
    'gpt-4': 'response',
    'gpt-4-turbo': 'response',
    'gpt-3.5-turbo': 'chat_completions',
    'gpt-3.5-turbo-16k': 'chat_completions',
    'gpt-4o': 'response',
    'gpt-4o-mini': 'response'
  };

  const modelMapper = new ModelMapper(testMapping);
  const router = new Router(modelMapper);

  describe('detectSourceFormat', () => {
    it('should detect response format from /v1/responses path', () => {
      expect(router.detectSourceFormat('/v1/responses')).toBe('response');
    });

    it('should detect chat_completions format from /v1/chat/completions path', () => {
      expect(router.detectSourceFormat('/v1/chat/completions')).toBe('chat_completions');
    });

    it('should handle paths with query parameters', () => {
      expect(router.detectSourceFormat('/v1/responses?timeout=30')).toBe('response');
      expect(router.detectSourceFormat('/v1/chat/completions?stream=true')).toBe('chat_completions');
    });

    it('should throw for unknown endpoint', () => {
      expect(() => router.detectSourceFormat('/v1/unknown')).toThrow(
        'Unknown endpoint: /v1/unknown'
      );
    });

    it('should throw for empty path', () => {
      expect(() => router.detectSourceFormat('')).toThrow(
        'Unknown endpoint: '
      );
    });
  });

  describe('extractModel', () => {
    it('should extract model from response format body', () => {
      const body = {
        model: 'gpt-4',
        messages: []
      };
      expect(router.extractModel(body)).toBe('gpt-4');
    });

    it('should extract model from chat_completions format body', () => {
      const body = {
        model: 'gpt-3.5-turbo',
        messages: []
      };
      expect(router.extractModel(body)).toBe('gpt-3.5-turbo');
    });

    it('should extract model with hyphens and dots', () => {
      const body = { model: 'gpt-3.5-turbo-16k' };
      expect(router.extractModel(body)).toBe('gpt-3.5-turbo-16k');
    });

    it('should throw when body is null', () => {
      expect(() => router.extractModel(null)).toThrow(ValidationError);
    });

    it('should throw when body is not an object', () => {
      expect(() => router.extractModel('not-an-object')).toThrow(ValidationError);
      expect(() => router.extractModel(123)).toThrow(ValidationError);
      expect(() => router.extractModel([])).toThrow(ValidationError);
    });

    it('should throw when model field is missing', () => {
      expect(() => router.extractModel({})).toThrow(ValidationError);
    });

    it('should throw when model field is not a string', () => {
      expect(() => router.extractModel({ model: 123 })).toThrow(ValidationError);
      expect(() => router.extractModel({ model: null })).toThrow(ValidationError);
      expect(() => router.extractModel({ model: {} })).toThrow(ValidationError);
    });

    it('should throw when model field is empty string', () => {
      expect(() => router.extractModel({ model: '' })).toThrow(ValidationError);
    });

    it('should use invalid_model_field error type for invalid model', () => {
      try {
        router.extractModel({ model: '' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).type).toBe(VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD);
      }
    });
  });

  describe('validateModel', () => {
    it('should pass validation for known models', () => {
      expect(() => router.validateModel('gpt-4')).not.toThrow();
      expect(() => router.validateModel('gpt-3.5-turbo')).not.toThrow();
      expect(() => router.validateModel('gpt-4-turbo')).not.toThrow();
      expect(() => router.validateModel('gpt-3.5-turbo-16k')).not.toThrow();
      expect(() => router.validateModel('gpt-4o')).not.toThrow();
      expect(() => router.validateModel('gpt-4o-mini')).not.toThrow();
    });

    it('should throw ValidationError for unknown models', () => {
      expect(() => router.validateModel('unknown-model')).toThrow(
        ValidationError
      );
    });

    it('should include model name in error message', () => {
      try {
        router.validateModel('unknown-model');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).message).toContain('unknown-model');
      }
    });

    it('should use correct error type', () => {
      try {
        router.validateModel('not-found');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).type).toBe(VALIDATION_ERROR_TYPES.UNKNOWN_MODEL);
      }
    });

    it('should have adapter_error source', () => {
      try {
        router.validateModel('missing');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).source).toBe('adapter_error');
      }
    });
  });

  describe('routingDecision', () => {
    describe('pass-through scenarios', () => {
      it('should route to pass-through when gpt-4 hits /v1/responses', () => {
        const body = { model: 'gpt-4' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('response');
        expect(result.model).toBe('gpt-4');
      });

      it('should route to pass-through when gpt-3.5-turbo hits /v1/chat/completions', () => {
        const body = { model: 'gpt-3.5-turbo' };
        const result = router.routingDecision('/v1/chat/completions', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('chat_completions');
        expect(result.targetFormat).toBe('chat_completions');
        expect(result.model).toBe('gpt-3.5-turbo');
      });

      it('should route gpt-4-turbo to pass-through at /v1/responses', () => {
        const body = { model: 'gpt-4-turbo' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('response');
      });

      it('should route gpt-4o to pass-through at /v1/responses', () => {
        const body = { model: 'gpt-4o' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('response');
      });

      it('should route gpt-4o-mini to pass-through at /v1/responses', () => {
        const body = { model: 'gpt-4o-mini' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('response');
      });

      it('should route gpt-3.5-turbo-16k to pass-through at /v1/chat/completions', () => {
        const body = { model: 'gpt-3.5-turbo-16k' };
        const result = router.routingDecision('/v1/chat/completions', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('chat_completions');
        expect(result.targetFormat).toBe('chat_completions');
      });
    });

    describe('translation scenarios', () => {
      it('should route to translate when gpt-3.5-turbo hits /v1/responses', () => {
        const body = { model: 'gpt-3.5-turbo' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('translate');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('chat_completions');
        expect(result.model).toBe('gpt-3.5-turbo');
      });

      it('should route to translate when gpt-4 hits /v1/chat/completions', () => {
        const body = { model: 'gpt-4' };
        const result = router.routingDecision('/v1/chat/completions', body);

        expect(result.decision).toBe('translate');
        expect(result.sourceFormat).toBe('chat_completions');
        expect(result.targetFormat).toBe('response');
        expect(result.model).toBe('gpt-4');
      });

      it('should route to translate when gpt-4-turbo hits /v1/chat/completions', () => {
        const body = { model: 'gpt-4-turbo' };
        const result = router.routingDecision('/v1/chat/completions', body);

        expect(result.decision).toBe('translate');
        expect(result.sourceFormat).toBe('chat_completions');
        expect(result.targetFormat).toBe('response');
      });

      it('should route to translate when gpt-3.5-turbo-16k hits /v1/responses', () => {
        const body = { model: 'gpt-3.5-turbo-16k' };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('translate');
        expect(result.sourceFormat).toBe('response');
        expect(result.targetFormat).toBe('chat_completions');
      });

      it('should route to translate when gpt-4o hits /v1/chat/completions', () => {
        const body = { model: 'gpt-4o' };
        const result = router.routingDecision('/v1/chat/completions', body);

        expect(result.decision).toBe('translate');
        expect(result.sourceFormat).toBe('chat_completions');
        expect(result.targetFormat).toBe('response');
      });
    });

    describe('error scenarios', () => {
      it('should throw ValidationError when model not in mapping', () => {
        const body = { model: 'unknown-model' };
        expect(() => router.routingDecision('/v1/responses', body)).toThrow(
          ValidationError
        );
      });

      it('should use correct validation error type', () => {
        const body = { model: 'unknown-model' };
        try {
          router.routingDecision('/v1/responses', body);
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValidationError).type).toBe(VALIDATION_ERROR_TYPES.UNKNOWN_MODEL);
        }
      });

      it('should throw when endpoint is invalid', () => {
        const body = { model: 'gpt-4' };
        expect(() => router.routingDecision('/v1/invalid', body)).toThrow(
          'Unknown endpoint: /v1/invalid'
        );
      });

      it('should throw when body is invalid', () => {
        expect(() => router.routingDecision('/v1/responses', null)).toThrow(
          ValidationError
        );
        
        expect(() => router.routingDecision('/v1/responses', {})).toThrow(
          ValidationError
        );
      });
    });

    describe('edge cases', () => {
      it('should work with endpoints that have query parameters', () => {
        const body = { model: 'gpt-4' };
        const result = router.routingDecision('/v1/responses?timeout=30', body);

        expect(result.decision).toBe('pass-through');
        expect(result.sourceFormat).toBe('response');
      });

      it('should preserve complete request body structure', () => {
        const body = {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          temperature: 0.7,
          max_tokens: 100
        };
        const result = router.routingDecision('/v1/responses', body);

        expect(result.decision).toBe('pass-through');
        expect(result.model).toBe('gpt-4');
      });
    });
  });
});

import { describe, it, expect } from 'vitest';
import { formatValidationError, isValidationErrorResponse, type ErrorResponse } from '../../../src/handlers/error-formatter.js';
import { ValidationError, VALIDATION_ERROR_TYPES } from '../../../src/types/validation-errors.js';

describe('Error Formatter', () => {
  describe('formatValidationError', () => {
    it('should format payload size error', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
        'Request payload exceeds maximum size of 10MB'
      );
      const requestId = '550e8400-e29b-41d4-a716-446655440000';

      const formatted = formatValidationError(error, requestId);

      expect(formatted).toEqual({
        error: {
          type: VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
          message: 'Request payload exceeds maximum size of 10MB',
          source: 'adapter_error'
        },
        requestId
      });
    });

    it('should format JSON depth error', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
        'JSON nesting depth exceeds maximum of 100 levels'
      );
      const requestId = 'test-request-id';

      const formatted = formatValidationError(error, requestId);

      expect(formatted).toEqual({
        error: {
          type: VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
          message: 'JSON nesting depth exceeds maximum of 100 levels',
          source: 'adapter_error'
        },
        requestId: 'test-request-id'
      });
    });

    it('should format unknown model error', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        "Model 'gpt-99' not found in configuration"
      );
      const requestId = 'another-id';

      const formatted = formatValidationError(error, requestId);

      expect(formatted).toEqual({
        error: {
          type: VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
          message: "Model 'gpt-99' not found in configuration",
          source: 'adapter_error'
        },
        requestId: 'another-id'
      });
    });

    it('should format invalid model field error', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD,
        'Model field is required and must be string'
      );
      const requestId = 'uuid-12345';

      const formatted = formatValidationError(error, requestId);

      expect(formatted).toEqual({
        error: {
          type: VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD,
          message: 'Model field is required and must be string',
          source: 'adapter_error'
        },
        requestId: 'uuid-12345'
      });
    });

    it('should preserve error message with special characters', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Model "special-model.v2" (API: response) not found'
      );
      const requestId = 'id-123';

      const formatted = formatValidationError(error, requestId);

      expect(formatted.error.message).toBe('Model "special-model.v2" (API: response) not found');
    });

    it('should support custom source error', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
        'Payload too large',
        'custom_source'
      );
      const requestId = 'id-456';

      const formatted = formatValidationError(error, requestId);

      expect(formatted.error.source).toBe('custom_source');
    });

    it('should handle different request ID formats', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
        'Depth exceeded'
      );

      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      const simpleId = 'request-123';
      const numericId = '1234567890';

      expect(formatValidationError(error, uuidId).requestId).toBe(uuidId);
      expect(formatValidationError(error, simpleId).requestId).toBe(simpleId);
      expect(formatValidationError(error, numericId).requestId).toBe(numericId);
    });
  });

  describe('isValidationErrorResponse', () => {
    it('should return true for ValidationError instances', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Not found'
      );

      expect(isValidationErrorResponse(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isValidationErrorResponse(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isValidationErrorResponse('string')).toBe(false);
      expect(isValidationErrorResponse(42)).toBe(false);
      expect(isValidationErrorResponse(null)).toBe(false);
      expect(isValidationErrorResponse(undefined)).toBe(false);
      expect(isValidationErrorResponse({})).toBe(false);
      expect(isValidationErrorResponse({ type: 'error' })).toBe(false);
    });
  });

  describe('Error response JSON structure', () => {
    it('should produce valid JSON', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Model not found'
      );
      const formatted = formatValidationError(error, 'test-id');

      // Should be JSON serializable
      const json = JSON.stringify(formatted);
      const parsed: ErrorResponse = JSON.parse(json);

      expect(parsed).toBeDefined();
      expect(parsed.error.type).toBeDefined();
      expect(parsed.error.message).toBeDefined();
      expect(parsed.error.source).toBeDefined();
      expect(parsed.requestId).toBeDefined();
    });

    it('should have consistent field ordering in response', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
        'Too large'
      );
      const formatted = formatValidationError(error, 'id');

      const keys = Object.keys(formatted);
      expect(keys).toContain('error');
      expect(keys).toContain('requestId');

      const errorKeys = Object.keys(formatted.error);
      expect(errorKeys).toContain('type');
      expect(errorKeys).toContain('message');
      expect(errorKeys).toContain('source');
    });
  });

  describe('All error types', () => {
    it('should correctly format all defined error types', () => {
      const errorTypes = [
        { type: VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE, message: 'Too large' },
        { type: VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED, message: 'Too deep' },
        { type: VALIDATION_ERROR_TYPES.UNKNOWN_MODEL, message: 'Unknown' },
        { type: VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD, message: 'Invalid' }
      ];

      for (const { type, message } of errorTypes) {
        const error = new ValidationError(type, message);
        const formatted = formatValidationError(error, 'id');

        expect(formatted.error.type).toBe(type);
        expect(formatted.error.message).toBe(message);
        expect(formatted.error.source).toBe('adapter_error');
      }
    });
  });
});

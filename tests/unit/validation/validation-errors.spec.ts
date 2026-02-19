import { describe, it, expect } from 'vitest';
import { ValidationError, VALIDATION_ERROR_TYPES, isValidationError } from '../../../src/types/validation-errors.js';

describe('ValidationError', () => {
  describe('Constructor and properties', () => {
    it('should create ValidationError with type, message, and source', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE,
        'Request payload exceeds maximum size of 10MB'
      );

      expect(error.type).toBe(VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE);
      expect(error.message).toBe('Request payload exceeds maximum size of 10MB');
      expect(error.source).toBe('adapter_error');
      expect(error.name).toBe('ValidationError');
    });

    it('should allow custom source value', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Model not found',
        'custom_source'
      );

      expect(error.source).toBe('custom_source');
    });

    it('should work with instanceof operator', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
        'JSON depth exceeded'
      );

      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Error types', () => {
    it('should have all required error type constants', () => {
      expect(VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE).toBe('payload_too_large');
      expect(VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED).toBe('json_depth_exceeded');
      expect(VALIDATION_ERROR_TYPES.UNKNOWN_MODEL).toBe('unknown_model');
      expect(VALIDATION_ERROR_TYPES.INVALID_MODEL_FIELD).toBe('invalid_model_field');
    });

    it('should support all error types when creating ValidationError', () => {
      const errorTypes = Object.values(VALIDATION_ERROR_TYPES);

      for (const type of errorTypes) {
        const error = new ValidationError(type, 'Test message');
        expect(error.type).toBe(type);
      }
    });
  });

  describe('isValidationError type guard', () => {
    it('should return true for ValidationError instances', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Model not found'
      );

      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isValidationError('string')).toBe(false);
      expect(isValidationError(null)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
      expect(isValidationError({})).toBe(false);
      expect(isValidationError(42)).toBe(false);
    });
  });

  describe('Error message handling', () => {
    it('should preserve error message with special characters', () => {
      const message = 'Model "unknown-model" (API: gpt-99) not found in configuration';
      const error = new ValidationError(VALIDATION_ERROR_TYPES.UNKNOWN_MODEL, message);

      expect(error.message).toBe(message);
    });

    it('should handle empty message', () => {
      const error = new ValidationError(VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE, '');
      expect(error.message).toBe('');
    });
  });

  describe('Inheritance and stack trace', () => {
    it('should have proper prototype chain', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED,
        'Depth exceeded'
      );

      // Verify prototype chain
      expect(Object.getPrototypeOf(error)).toBe(ValidationError.prototype);
    });

    it('should have stack trace', () => {
      const error = new ValidationError(
        VALIDATION_ERROR_TYPES.UNKNOWN_MODEL,
        'Test error'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });
});

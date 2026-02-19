import { describe, it, expect } from 'vitest';
import { validatePayloadSize } from '../../../src/validation/payload-size-validator.js';
import { ValidationError, VALIDATION_ERROR_TYPES } from '../../../src/types/validation-errors.js';

describe('validatePayloadSize', () => {
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  const MAX_SIZE_MB = 10;

  describe('Valid payloads', () => {
    it('should pass for payload exactly at limit', () => {
      const contentLength = String(MAX_SIZE_BYTES);
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass for payload below limit', () => {
      const contentLength = String(MAX_SIZE_BYTES - 1);
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass for small payload', () => {
      const contentLength = '1024'; // 1KB
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass for zero-sized payload', () => {
      const contentLength = '0';
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });
  });

  describe('Invalid payloads', () => {
    it('should reject payload exceeding limit by 1 byte', () => {
      const contentLength = String(MAX_SIZE_BYTES + 1);
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).toThrow(
        ValidationError
      );
    });

    it('should reject payload exceeding limit significantly', () => {
      const contentLength = String(MAX_SIZE_BYTES * 2); // 20MB
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).toThrow(
        ValidationError
      );
    });

    it('should reject payload with double the limit', () => {
      const contentLength = String(20 * 1024 * 1024); // 20MB when limit is 10MB
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).toThrow(
        ValidationError
      );
    });
  });

  describe('Error details', () => {
    it('should provide correct error type for oversized payload', () => {
      const contentLength = String(MAX_SIZE_BYTES + 1);
      try {
        validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).type).toBe(VALIDATION_ERROR_TYPES.PAYLOAD_TOO_LARGE);
      }
    });

    it('should include size limit in error message', () => {
      const contentLength = String(MAX_SIZE_BYTES + 1);
      try {
        validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).message).toContain('10MB');
      }
    });

    it('should have source property set to adapter_error', () => {
      const contentLength = String(MAX_SIZE_BYTES + 1);
      try {
        validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).source).toBe('adapter_error');
      }
    });
  });

  describe('Missing Content-Length header', () => {
    it('should pass when Content-Length header is undefined', () => {
      expect(() => validatePayloadSize(undefined, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass when Content-Length header is empty string', () => {
      expect(() => validatePayloadSize('', MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });
  });

  describe('Malformed Content-Length', () => {
    it('should pass when Content-Length is not a valid number', () => {
      const contentLength = 'not-a-number';
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass when Content-Length has non-numeric characters', () => {
      const contentLength = '1024KB';
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass when Content-Length is floating point', () => {
      const contentLength = '1024.5';
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });

    it('should pass when Content-Length is negative (after parseInt)', () => {
      const contentLength = '-1024';
      // parseInt('-1024') = -1024, which is less than maxSizeBytes, so should pass
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });
  });

  describe('Different size configurations', () => {
    it('should work with 1MB limit', () => {
      const limit1MB = 1 * 1024 * 1024;
      expect(() => validatePayloadSize(String(limit1MB), limit1MB, 1)).not.toThrow();
      expect(() => validatePayloadSize(String(limit1MB + 1), limit1MB, 1)).toThrow();
    });

    it('should work with 100MB limit', () => {
      const limit100MB = 100 * 1024 * 1024;
      expect(() => validatePayloadSize(String(limit100MB), limit100MB, 100)).not.toThrow();
      expect(() => validatePayloadSize(String(limit100MB + 1), limit100MB, 100)).toThrow();
    });

    it('should work with very large limits', () => {
      const limitLarge = 1000 * 1024 * 1024; // 1000MB
      expect(() => validatePayloadSize(String(limitLarge), limitLarge, 1000)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large Content-Length values', () => {
      const contentLength = String(Number.MAX_SAFE_INTEGER);
      // Should throw because MAX_SAFE_INTEGER is much larger than 10MB
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).toThrow();
    });

    it('should handle scientific notation in Content-Length', () => {
      const contentLength = '1e6'; // 1000000 in scientific notation
      // parseInt('1e6') = 1 (stops at 'e'), so it's below limit
      expect(() => validatePayloadSize(contentLength, MAX_SIZE_BYTES, MAX_SIZE_MB)).not.toThrow();
    });
  });
});

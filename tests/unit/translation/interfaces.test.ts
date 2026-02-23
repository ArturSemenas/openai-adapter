/**
 * Unit tests for translation interfaces
 * Tests interface definitions and type checking
 */

import { describe, it, expect } from 'vitest';
import type {
  RequestTranslator,
  ResponseTranslator,
  TranslationResult,
  TranslationOptions
} from '../../../src/translation/interfaces.js';

describe('Translation Interfaces', () => {
  describe('RequestTranslator Interface', () => {
    it('should have translateRequest method', () => {
      // This test will fail until interfaces.ts is created
      const mockTranslator: RequestTranslator = {
        translateRequest: (_request: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidRequest: (_request: unknown) => true
      };

      expect(mockTranslator.translateRequest).toBeDefined();
      expect(typeof mockTranslator.translateRequest).toBe('function');
    });

    it('should have isValidRequest method', () => {
      const mockTranslator: RequestTranslator = {
        translateRequest: (_request: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidRequest: (_request: unknown) => true
      };

      expect(mockTranslator.isValidRequest).toBeDefined();
      expect(typeof mockTranslator.isValidRequest).toBe('function');
    });

    it('should accept generic type parameters', () => {
      interface TestInput {
        field: string;
      }
      interface TestOutput {
        mapped: string;
      }

      const typedTranslator: RequestTranslator<TestInput, TestOutput> = {
        translateRequest: (request: TestInput, _options: TranslationOptions) => ({
          success: true,
          translated: { mapped: request.field },
          unknownFields: []
        }),
        isValidRequest: (request: unknown): request is TestInput => {
          return typeof request === 'object' && request !== null && 'field' in request;
        }
      };

      const result = typedTranslator.translateRequest(
        { field: 'test' },
        { requestId: 'test-123' }
      );

      expect(result.success).toBe(true);
      expect(result.translated?.mapped).toBe('test');
    });
  });

  describe('ResponseTranslator Interface', () => {
    it('should have translateResponse method', () => {
      const mockTranslator: ResponseTranslator = {
        translateResponse: (_response: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidResponse: (_response: unknown) => true
      };

      expect(mockTranslator.translateResponse).toBeDefined();
      expect(typeof mockTranslator.translateResponse).toBe('function');
    });

    it('should have isValidResponse method', () => {
      const mockTranslator: ResponseTranslator = {
        translateResponse: (_response: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidResponse: (_response: unknown) => true
      };

      expect(mockTranslator.isValidResponse).toBeDefined();
      expect(typeof mockTranslator.isValidResponse).toBe('function');
    });

    it('should accept generic type parameters', () => {
      interface TestInput {
        data: string;
      }
      interface TestOutput {
        result: string;
      }

      const typedTranslator: ResponseTranslator<TestInput, TestOutput> = {
        translateResponse: (response: TestInput, _options: TranslationOptions) => ({
          success: true,
          translated: { result: response.data },
          unknownFields: []
        }),
        isValidResponse: (response: unknown): response is TestInput => {
          return typeof response === 'object' && response !== null && 'data' in response;
        }
      };

      const result = typedTranslator.translateResponse(
        { data: 'test' },
        { requestId: 'test-123' }
      );

      expect(result.success).toBe(true);
      expect(result.translated?.result).toBe('test');
    });
  });

  describe('TranslationResult Interface', () => {
    it('should have success field', () => {
      const result: TranslationResult = {
        success: true,
        unknownFields: []
      };

      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should have optional translated field', () => {
      const successResult: TranslationResult<{ data: string }> = {
        success: true,
        translated: { data: 'test' },
        unknownFields: []
      };

      expect(successResult.translated).toBeDefined();
      expect(successResult.translated?.data).toBe('test');
    });

    it('should have optional error field', () => {
      const errorResult: TranslationResult = {
        success: false,
        error: 'Translation failed',
        unknownFields: []
      };

      expect(errorResult.error).toBeDefined();
      expect(typeof errorResult.error).toBe('string');
    });

    it('should have unknownFields array', () => {
      const result: TranslationResult = {
        success: true,
        unknownFields: ['field1', 'field2']
      };

      expect(result.unknownFields).toBeDefined();
      expect(Array.isArray(result.unknownFields)).toBe(true);
      expect(result.unknownFields).toEqual(['field1', 'field2']);
    });
  });

  describe('TranslationOptions Interface', () => {
    it('should have requestId field', () => {
      const options: TranslationOptions = {
        requestId: 'test-123'
      };

      expect(options.requestId).toBeDefined();
      expect(typeof options.requestId).toBe('string');
    });

    it('should have optional strict field', () => {
      const strictOptions: TranslationOptions = {
        requestId: 'test-123',
        strict: true
      };

      expect(strictOptions.strict).toBeDefined();
      expect(typeof strictOptions.strict).toBe('boolean');
    });

    it('should work without strict field', () => {
      const options: TranslationOptions = {
        requestId: 'test-123'
      };

      expect(options.strict).toBeUndefined();
    });
  });

  describe('Interface Segregation', () => {
    it('should allow RequestTranslator without ResponseTranslator methods', () => {
      // Verify ISP: RequestTranslator doesn't need response methods
      const requestOnly: RequestTranslator = {
        translateRequest: (_request: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidRequest: (_request: unknown) => true
      };

      expect(requestOnly.translateRequest).toBeDefined();
      expect(requestOnly.isValidRequest).toBeDefined();
      // Should not have response methods
      expect('translateResponse' in requestOnly).toBe(false);
      expect('isValidResponse' in requestOnly).toBe(false);
    });

    it('should allow ResponseTranslator without RequestTranslator methods', () => {
      // Verify ISP: ResponseTranslator doesn't need request methods
      const responseOnly: ResponseTranslator = {
        translateResponse: (_response: unknown, _options: TranslationOptions) => ({
          success: true,
          translated: {},
          unknownFields: []
        }),
        isValidResponse: (_response: unknown) => true
      };

      expect(responseOnly.translateResponse).toBeDefined();
      expect(responseOnly.isValidResponse).toBeDefined();
      // Should not have request methods
      expect('translateRequest' in responseOnly).toBe(false);
      expect('isValidRequest' in responseOnly).toBe(false);
    });
  });
});

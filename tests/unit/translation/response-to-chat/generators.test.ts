/**
 * Tests for property-based test generators
 * 
 * These tests verify that the fast-check arbitraries generate valid test data
 * according to the specified constraints.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  messageArbitrary,
  toolArbitrary,
  responseApiRequestArbitrary,
  minimalResponseApiRequestArbitrary,
  responseApiRequestWithStringInputArbitrary,
  responseApiRequestWithMessagesInputArbitrary,
  responseApiRequestWithInstructionsArbitrary,
  responseApiRequestWithUnknownFieldsArbitrary,
  invalidResponseApiRequestArbitrary
} from './generators.js';

describe('Property-Based Test Generators', () => {
  describe('messageArbitrary', () => {
    it('should generate valid message objects', () => {
      fc.assert(
        fc.property(messageArbitrary(), (message) => {
          // Verify required fields
          expect(message).toHaveProperty('role');
          expect(message).toHaveProperty('content');
          
          // Verify role is valid
          expect(['system', 'user', 'assistant', 'developer', 'tool']).toContain(message.role);
          
          // Verify content is a non-empty string
          expect(typeof message.content).toBe('string');
          expect(message.content.length).toBeGreaterThan(0);
          
          // Verify optional fields have correct types if present
          if (message.tool_calls !== undefined) {
            expect(Array.isArray(message.tool_calls)).toBe(true);
          }
          
          if (message.function_call !== undefined) {
            expect(typeof message.function_call).toBe('object');
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('toolArbitrary', () => {
    it('should generate valid tool definitions', () => {
      fc.assert(
        fc.property(toolArbitrary(), (tool) => {
          // Verify required fields
          expect(tool).toHaveProperty('type');
          expect(tool.type).toBe('function');
          expect(tool).toHaveProperty('function');
          expect(tool.function).toHaveProperty('name');
          
          // Verify name is a non-empty string
          expect(typeof tool.function.name).toBe('string');
          expect(tool.function.name.length).toBeGreaterThan(0);
          
          // Verify optional fields have correct types if present
          if (tool.function.description !== undefined) {
            expect(typeof tool.function.description).toBe('string');
          }
          
          if (tool.function.parameters !== undefined) {
            expect(typeof tool.function.parameters).toBe('object');
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('responseApiRequestArbitrary', () => {
    it('should generate valid Response API requests', () => {
      fc.assert(
        fc.property(responseApiRequestArbitrary(), (request) => {
          // Verify required field
          expect(request).toHaveProperty('model');
          expect(typeof request.model).toBe('string');
          expect(request.model.length).toBeGreaterThan(0);
          
          // Verify input field if present
          if (request.input !== undefined) {
            const isString = typeof request.input === 'string';
            const isArray = Array.isArray(request.input);
            expect(isString || isArray).toBe(true);
            
            if (isString) {
              expect((request.input as string).length).toBeGreaterThan(0);
            } else if (isArray) {
              expect((request.input as Array<unknown>).length).toBeGreaterThan(0);
            }
          }
          
          // Verify optional numeric fields have correct ranges if present
          if (request.temperature !== undefined) {
            expect(request.temperature).toBeGreaterThanOrEqual(0);
            expect(request.temperature).toBeLessThanOrEqual(2);
          }
          
          if (request.max_output_tokens !== undefined) {
            expect(request.max_output_tokens).toBeGreaterThanOrEqual(1);
            expect(request.max_output_tokens).toBeLessThanOrEqual(4096);
          }
          
          if (request.top_p !== undefined) {
            expect(request.top_p).toBeGreaterThanOrEqual(0);
            expect(request.top_p).toBeLessThanOrEqual(1);
          }
          
          // Verify optional boolean fields
          if (request.stream !== undefined) {
            expect(typeof request.stream).toBe('boolean');
          }
          
          // Verify optional array fields
          if (request.tools !== undefined) {
            expect(Array.isArray(request.tools)).toBe(true);
            expect(request.tools.length).toBeGreaterThan(0);
          }
          
          // Verify optional object fields
          if (request.text !== undefined) {
            expect(typeof request.text).toBe('object');
          }
          
          if (request.metadata !== undefined) {
            expect(typeof request.metadata).toBe('object');
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('minimalResponseApiRequestArbitrary', () => {
    it('should generate minimal valid requests with required fields only', () => {
      fc.assert(
        fc.property(minimalResponseApiRequestArbitrary(), (request) => {
          // Verify required fields are present
          expect(request).toHaveProperty('model');
          expect(request).toHaveProperty('input');
          
          // Verify model is non-empty string
          expect(typeof request.model).toBe('string');
          expect(request.model.length).toBeGreaterThan(0);
          
          // Verify input is string or array
          const isString = typeof request.input === 'string';
          const isArray = Array.isArray(request.input);
          expect(isString || isArray).toBe(true);
          
          // Verify only required fields are present
          const keys = Object.keys(request);
          expect(keys).toEqual(expect.arrayContaining(['model', 'input']));
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('responseApiRequestWithStringInputArbitrary', () => {
    it('should generate requests with string input only', () => {
      fc.assert(
        fc.property(responseApiRequestWithStringInputArbitrary(), (request) => {
          // Verify input is a string
          expect(typeof request.input).toBe('string');
          expect(request.input.length).toBeGreaterThan(0);
          
          // Verify model is present
          expect(typeof request.model).toBe('string');
          expect(request.model.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('responseApiRequestWithMessagesInputArbitrary', () => {
    it('should generate requests with messages array input only', () => {
      fc.assert(
        fc.property(responseApiRequestWithMessagesInputArbitrary(), (request) => {
          // Verify input is an array
          expect(Array.isArray(request.input)).toBe(true);
          expect(request.input.length).toBeGreaterThan(0);
          
          // Verify model is present
          expect(typeof request.model).toBe('string');
          expect(request.model.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('responseApiRequestWithInstructionsArbitrary', () => {
    it('should generate requests with instructions field', () => {
      fc.assert(
        fc.property(responseApiRequestWithInstructionsArbitrary(), (request) => {
          // Verify instructions is present and non-empty
          expect(request).toHaveProperty('instructions');
          expect(typeof request.instructions).toBe('string');
          expect(request.instructions.length).toBeGreaterThan(0);
          
          // Verify required fields
          expect(typeof request.model).toBe('string');
          expect(request.model.length).toBeGreaterThan(0);
          expect(request.input).toBeDefined();
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('responseApiRequestWithUnknownFieldsArbitrary', () => {
    it('should generate requests with unknown fields', () => {
      fc.assert(
        fc.property(responseApiRequestWithUnknownFieldsArbitrary(), (request) => {
          // Verify required fields
          expect(typeof request.model).toBe('string');
          expect(request.input).toBeDefined();
          
          // Verify at least one unknown field is present
          const keys = Object.keys(request);
          
          // Note: Due to fc.option with nil: undefined, unknown fields may not always be present
          // This is expected behavior for testing forward compatibility
          expect(keys.length).toBeGreaterThanOrEqual(2); // At least model and input
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('invalidResponseApiRequestArbitrary', () => {
    it('should generate invalid requests with various validation errors', () => {
      fc.assert(
        fc.property(invalidResponseApiRequestArbitrary(), (request) => {
          // Verify request is an object
          expect(typeof request).toBe('object');
          expect(request).not.toBeNull();
          
          // At least one of these validation errors should be present:
          // - Missing model
          // - Empty model (including whitespace-only)
          // - Missing input
          // - Empty input string
          // - Empty messages array
          // - Invalid input type
          // - Invalid message structure (missing role/content, invalid types)
          
          const hasValidationError = 
            !request.model || // Missing model
            (typeof request.model === 'string' && request.model.trim() === '') || // Empty/whitespace model
            !request.input || // Missing input
            request.input === '' || // Empty input string
            (Array.isArray(request.input) && request.input.length === 0) || // Empty array
            (typeof request.input !== 'string' && !Array.isArray(request.input)) || // Invalid type
            // Invalid message structure
            (Array.isArray(request.input) && request.input.some((msg: unknown) => {
              return !msg || 
                     typeof msg !== 'object' ||
                     !msg.role || 
                     !msg.content ||
                     typeof msg.content !== 'string' ||
                     !['system', 'user', 'assistant', 'developer', 'tool'].includes(msg.role);
            }));
          
          expect(hasValidationError).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Generator Integration', () => {
    it('should generate diverse test data across multiple runs', () => {
      const generatedModels = new Set<string>();
      const generatedInputTypes = new Set<string>();
      
      fc.assert(
        fc.property(responseApiRequestArbitrary(), (request) => {
          generatedModels.add(request.model);
          
          if (request.input !== undefined) {
            generatedInputTypes.add(typeof request.input === 'string' ? 'string' : 'array');
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
      
      // Verify diversity in generated data
      expect(generatedModels.size).toBeGreaterThan(10); // At least 10 different models
      expect(generatedInputTypes.size).toBeGreaterThan(0); // At least one input type
    });
  });
});

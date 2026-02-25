/**
 * Property-based tests for Response API to Chat Completions request translation
 * 
 * This test suite validates the core translation logic using property-based testing
 * with fast-check. Each property test runs a minimum of 100 iterations to ensure
 * comprehensive coverage across the input space.
 * 
 * Following TDD methodology: These tests are written FIRST and should FAIL until
 * the implementation is complete.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  responseApiRequestArbitrary,
  minimalResponseApiRequestArbitrary,
  responseApiRequestWithStringInputArbitrary,
  responseApiRequestWithMessagesInputArbitrary,
  responseApiRequestWithInstructionsArbitrary,
  responseApiRequestWithUnknownFieldsArbitrary,
  invalidResponseApiRequestArbitrary,
  toolArbitrary
} from './generators.js';
import { PROPERTY_TEST_CONFIG, getTestTimeout } from './test-config.js';

// Import the functions we're testing (these don't exist yet - TDD Red Phase)
// @ts-expect-error - Module doesn't exist yet (TDD Red Phase)
import { translateResponseToChat } from '../../../../src/translation/response-to-chat/request.js';
// @ts-expect-error - Module doesn't exist yet (TDD Red Phase)
import { translateChatToResponse } from '../../../../src/translation/chat-to-response/request.js';

describe('Response API to Chat Completions Translation - Property-Based Tests', () => {
  /**
   * Property 1: Round-trip Translation Preserves Semantic Equivalence
   * 
   * Feature: response-to-chat-translation, Property 1: Round-trip preserves semantic equivalence
   * Validates: Requirements 1.5, 2.8, 4.3, 9.5, 10.5
   * 
   * For any valid Response API request, translating it to Chat Completions format
   * and then back to Response API format SHALL produce a semantically equivalent request.
   */
  it(
    'Property 1: Round-trip translation preserves semantic equivalence',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 1: Round-trip preserves semantic equivalence
            
            // Translate Response → Chat
            const chatResult = translateResponseToChat(request, { requestId: 'test-prop-1' });
            expect(chatResult.success).toBe(true);
            expect(chatResult.translated).toBeDefined();
            
            // Translate Chat → Response
            const backResult = translateChatToResponse(chatResult.translated, { requestId: 'test-prop-1' });
            expect(backResult.success).toBe(true);
            expect(backResult.translated).toBeDefined();
            
            // Verify semantic equivalence
            const original = request;
            const roundTrip = backResult.translated;
            
            // Model must be identical
            expect(roundTrip.model).toBe(original.model);
            
            // Input content must be preserved (whether string or messages array)
            // Note: Round-trip may convert string → messages array → messages array
            // because Chat→Response always uses messages arrays
            if (typeof original.input === 'string') {
              // Original was string, round-trip might be string or messages array
              if (typeof roundTrip.input === 'string') {
                expect(roundTrip.input).toBe(original.input);
              } else if (Array.isArray(roundTrip.input)) {
                // String became messages array - check semantic equivalence
                // If original had instructions, round-trip will have system message + user message
                if (original.instructions) {
                  expect(roundTrip.input.length).toBeGreaterThanOrEqual(2);
                  // First message should be system with instructions
                  expect(roundTrip.input[0].role).toBe('system');
                  expect(roundTrip.input[0].content).toBe(original.instructions);
                  // Second message should be user with original input
                  expect(roundTrip.input[1].role).toBe('user');
                  expect(roundTrip.input[1].content).toBe(original.input);
                } else {
                  // No instructions, should be single user message
                  expect(roundTrip.input).toHaveLength(1);
                  expect(roundTrip.input[0].role).toBe('user');
                  expect(roundTrip.input[0].content).toBe(original.input);
                }
              }
            } else if (Array.isArray(original.input)) {
              expect(Array.isArray(roundTrip.input)).toBe(true);
              // If original had instructions, round-trip will have system message prepended
              if (original.instructions) {
                expect(roundTrip.input.length).toBe(original.input.length + 1);
                expect(roundTrip.input[0].role).toBe('system');
                expect(roundTrip.input[0].content).toBe(original.instructions);
                expect(roundTrip.input.slice(1)).toEqual(original.input);
              } else {
                expect(roundTrip.input).toEqual(original.input);
              }
            }
            
            // Optional parameters must have equivalent values
            if (original.temperature !== undefined) {
              expect(roundTrip.temperature).toBe(original.temperature);
            }
            if (original.max_output_tokens !== undefined) {
              expect(roundTrip.max_output_tokens).toBe(original.max_output_tokens);
            }
            if (original.top_p !== undefined) {
              expect(roundTrip.top_p).toBe(original.top_p);
            }
            if (original.stream !== undefined) {
              expect(roundTrip.stream).toBe(original.stream);
            }
            
            // Tools and tool_choice must be preserved
            if (original.tools !== undefined) {
              expect(roundTrip.tools).toEqual(original.tools);
            }
            if (original.tool_choice !== undefined) {
              expect(roundTrip.tool_choice).toEqual(original.tool_choice);
            }
            
            // Metadata must be preserved
            if (original.metadata !== undefined) {
              expect(roundTrip.metadata).toEqual(original.metadata);
            }
            
            // Unknown fields must be preserved
            // (Check for fields not in the known mapping)
            const knownFields = new Set([
              'model', 'input', 'instructions', 'temperature', 'max_output_tokens',
              'top_p', 'stream', 'tools', 'tool_choice', 'text', 'metadata', 'thread_id'
            ]);
            
            for (const key in original) {
              if (!knownFields.has(key)) {
                expect(roundTrip).toHaveProperty(key);
                expect(roundTrip[key]).toEqual(original[key]);
              }
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 2: Standard Parameter Mapping Preserves Values
   * 
   * Feature: response-to-chat-translation, Property 2: Standard parameter mapping preserves values
   * Validates: Requirements 2.1, 2.4, 2.5, 2.6, 2.7
   * 
   * For any Response API request containing standard parameters, the translated
   * Chat Completions request SHALL contain the same values mapped to their equivalent fields.
   */
  it(
    'Property 2: Standard parameter mapping preserves values',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 2: Standard parameter mapping preserves values
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-2' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // model → model (identical)
            expect(translated.model).toBe(request.model);
            
            // temperature → temperature (identical)
            if (request.temperature !== undefined) {
              expect(translated.temperature).toBe(request.temperature);
            }
            
            // max_output_tokens → max_tokens (identical value, different name)
            if (request.max_output_tokens !== undefined) {
              expect(translated.max_tokens).toBe(request.max_output_tokens);
              expect(translated).not.toHaveProperty('max_output_tokens');
            }
            
            // top_p → top_p (identical)
            if (request.top_p !== undefined) {
              expect(translated.top_p).toBe(request.top_p);
            }
            
            // stream → stream (identical)
            if (request.stream !== undefined) {
              expect(translated.stream).toBe(request.stream);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 3: String Input Converts to Single User Message
   * 
   * Feature: response-to-chat-translation, Property 3: String input converts to single user message
   * Validates: Requirements 2.2
   * 
   * For any Response API request where input is a non-empty string, the translated
   * Chat Completions request SHALL contain a messages array with exactly one message
   * having role "user" and content equal to the input string.
   */
  it(
    'Property 3: String input converts to single user message',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestWithStringInputArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 3: String input converts to single user message
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-3' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Must have messages array
            expect(translated.messages).toBeDefined();
            expect(Array.isArray(translated.messages)).toBe(true);
            
            // If no instructions, should have exactly one message
            if (!request.instructions) {
              expect(translated.messages).toHaveLength(1);
              expect(translated.messages[0].role).toBe('user');
              expect(translated.messages[0].content).toBe(request.input);
            } else {
              // If instructions present, should have two messages (system + user)
              expect(translated.messages.length).toBeGreaterThanOrEqual(2);
              const userMessage = translated.messages.find((m: { role: string; content: string }) => m.role === 'user');
              expect(userMessage).toBeDefined();
              expect(userMessage.content).toBe(request.input);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 4: Messages Array Input Passes Through Directly
   * 
   * Feature: response-to-chat-translation, Property 4: Messages array input passes through directly
   * Validates: Requirements 2.2, 9.1
   * 
   * For any Response API request where input is a messages array, the translated
   * Chat Completions request SHALL contain the same messages array (both formats
   * use identical message structure per OpenAI documentation).
   */
  it(
    'Property 4: Messages array input passes through directly',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestWithMessagesInputArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 4: Messages array input passes through directly
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-4' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Must have messages array
            expect(translated.messages).toBeDefined();
            expect(Array.isArray(translated.messages)).toBe(true);
            
            // If no instructions, messages should be identical to input
            if (!request.instructions) {
              expect(translated.messages).toEqual(request.input);
            } else {
              // If instructions present, input messages should be after system message
              expect(translated.messages.length).toBe((request.input as Array<unknown>).length + 1);
              expect(translated.messages[0].role).toBe('system');
              expect(translated.messages.slice(1)).toEqual(request.input);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 5: Instructions Prepend as System Message
   * 
   * Feature: response-to-chat-translation, Property 5: Instructions prepend as system message
   * Validates: Requirements 2.3
   * 
   * For any Response API request containing an instructions field and an input field,
   * the translated Chat Completions messages array SHALL have the instructions as the
   * first message with role "system", followed by the input messages.
   */
  it(
    'Property 5: Instructions prepend as system message',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestWithInstructionsArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 5: Instructions prepend as system message
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-5' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Must have messages array
            expect(translated.messages).toBeDefined();
            expect(Array.isArray(translated.messages)).toBe(true);
            expect(translated.messages.length).toBeGreaterThan(0);
            
            // First message must be system message with instructions content
            expect(translated.messages[0].role).toBe('system');
            expect(translated.messages[0].content).toBe(request.instructions);
            
            // Remaining messages should be from input
            if (typeof request.input === 'string') {
              expect(translated.messages).toHaveLength(2);
              expect(translated.messages[1].role).toBe('user');
              expect(translated.messages[1].content).toBe(request.input);
            } else if (Array.isArray(request.input)) {
              expect(translated.messages.length).toBe(request.input.length + 1);
              expect(translated.messages.slice(1)).toEqual(request.input);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 6: Tools and Tool Choice Pass Through
   * 
   * Feature: response-to-chat-translation, Property 6: Tools and tool choice pass through
   * Validates: Requirements 3.1, 3.2, 10.1, 10.2
   * 
   * For any Response API request containing tools and/or tool_choice fields, the
   * translated Chat Completions request SHALL contain identical tools and tool_choice
   * values (both formats use the same structure per OpenAI documentation).
   */
  it(
    'Property 6: Tools and tool choice pass through',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            input: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            tools: fc.array(toolArbitrary(), { minLength: 1, maxLength: 5 }),
            tool_choice: fc.oneof(
              fc.constantFrom('none', 'auto', 'required'),
              fc.record({
                type: fc.constant('function'),
                function: fc.record({
                  name: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0)
                })
              })
            )
          }),
          (request) => {
            // Feature: response-to-chat-translation, Property 6: Tools and tool choice pass through
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-6' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Tools must be preserved with identical structure
            expect(translated.tools).toEqual(request.tools);
            
            // Tool choice must be preserved with identical structure
            expect(translated.tool_choice).toEqual(request.tool_choice);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 7: Text Format Maps to Response Format Type
   * 
   * Feature: response-to-chat-translation, Property 7: Text format maps to response format type
   * Validates: Requirements 3.3
   * 
   * For any Response API request containing a text.format field, the translated
   * Chat Completions request SHALL contain a response_format object with type field
   * equal to the text.format value.
   */
  it(
    'Property 7: Text format maps to response format type',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            input: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            text: fc.record({
              format: fc.constantFrom('text', 'json_object')
            })
          }),
          (request) => {
            // Feature: response-to-chat-translation, Property 7: Text format maps to response format type
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-7' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Must have response_format object
            expect(translated.response_format).toBeDefined();
            expect(typeof translated.response_format).toBe('object');
            
            // response_format.type must equal text.format
            expect(translated.response_format.type).toBe(request.text.format);
            
            // Original text field should not be in translated request
            expect(translated).not.toHaveProperty('text');
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 8: Metadata Preserves Key-Value Pairs
   * 
   * Feature: response-to-chat-translation, Property 8: Metadata preserves key-value pairs
   * Validates: Requirements 3.4
   * 
   * For any Response API request containing a metadata object, the translated
   * Chat Completions request SHALL contain an identical metadata object with all
   * key-value pairs preserved.
   */
  it(
    'Property 8: Metadata preserves key-value pairs',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            input: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
            metadata: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.oneof(
                fc.string({ maxLength: 100 }),
                fc.integer(),
                fc.boolean()
              ),
              { minKeys: 1, maxKeys: 5 }
            )
          }),
          (request) => {
            // Feature: response-to-chat-translation, Property 8: Metadata preserves key-value pairs
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-8' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Metadata must be preserved with all key-value pairs
            expect(translated.metadata).toEqual(request.metadata);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 9: Absent Optional Fields Are Omitted
   * 
   * Feature: response-to-chat-translation, Property 9: Absent optional fields are omitted
   * Validates: Requirements 3.5
   * 
   * For any Response API request where optional fields are absent, the translated
   * Chat Completions request SHALL not contain the corresponding fields.
   */
  it(
    'Property 9: Absent optional fields are omitted',
    () => {
      fc.assert(
        fc.property(
          minimalResponseApiRequestArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 9: Absent optional fields are omitted
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-9' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Required fields must be present
            expect(translated.model).toBeDefined();
            expect(translated.messages).toBeDefined();
            
            // Optional fields should not be present if not in original request
            if (request.temperature === undefined) {
              expect(translated).not.toHaveProperty('temperature');
            }
            if (request.max_output_tokens === undefined) {
              expect(translated).not.toHaveProperty('max_tokens');
            }
            if (request.top_p === undefined) {
              expect(translated).not.toHaveProperty('top_p');
            }
            if (request.stream === undefined) {
              expect(translated).not.toHaveProperty('stream');
            }
            if (request.tools === undefined) {
              expect(translated).not.toHaveProperty('tools');
            }
            if (request.tool_choice === undefined) {
              expect(translated).not.toHaveProperty('tool_choice');
            }
            if (request.text === undefined) {
              expect(translated).not.toHaveProperty('response_format');
            }
            if (request.metadata === undefined) {
              expect(translated).not.toHaveProperty('metadata');
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 10: Unknown Fields Are Preserved
   * 
   * Feature: response-to-chat-translation, Property 10: Unknown fields are preserved
   * Validates: Requirements 4.1, 4.2
   * 
   * For any Response API request containing fields not in the known mapping, the
   * translated Chat Completions request SHALL contain those same unknown fields with
   * identical values, enabling forward compatibility with future API versions.
   */
  it(
    'Property 10: Unknown fields are preserved',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestWithUnknownFieldsArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 10: Unknown fields are preserved
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-10' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Unknown fields must be preserved
            const knownFields = new Set([
              'model', 'input', 'instructions', 'temperature', 'max_output_tokens',
              'top_p', 'stream', 'tools', 'tool_choice', 'text', 'metadata', 'thread_id'
            ]);
            
            for (const key in request) {
              if (!knownFields.has(key) && request[key] !== undefined) {
                expect(translated).toHaveProperty(key);
                expect(translated[key]).toEqual(request[key]);
              }
            }
            
            // unknownFields array should list the preserved fields
            expect(result.unknownFields).toBeDefined();
            expect(Array.isArray(result.unknownFields)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 11: Translated Output Is Valid Chat Completions Format
   * 
   * Feature: response-to-chat-translation, Property 11: Translated output is valid Chat Completions format
   * Validates: Requirements 5.1
   * 
   * For any valid Response API request that translates successfully, the resulting
   * Chat Completions request SHALL conform to the Chat Completions schema.
   */
  it(
    'Property 11: Translated output is valid Chat Completions format',
    () => {
      fc.assert(
        fc.property(
          responseApiRequestArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 11: Translated output is valid Chat Completions format
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-11' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Must have required fields
            expect(translated.model).toBeDefined();
            expect(typeof translated.model).toBe('string');
            expect(translated.model.length).toBeGreaterThan(0);
            
            expect(translated.messages).toBeDefined();
            expect(Array.isArray(translated.messages)).toBe(true);
            expect(translated.messages.length).toBeGreaterThan(0);
            
            // Each message must have valid structure
            for (const message of translated.messages) {
              expect(message.role).toBeDefined();
              expect(typeof message.role).toBe('string');
              expect(['system', 'user', 'assistant', 'developer', 'tool']).toContain(message.role);
              
              expect(message.content).toBeDefined();
              expect(typeof message.content).toBe('string');
            }
            
            // Optional fields must have correct types if present
            if (translated.temperature !== undefined) {
              expect(typeof translated.temperature).toBe('number');
            }
            if (translated.max_tokens !== undefined) {
              expect(typeof translated.max_tokens).toBe('number');
            }
            if (translated.top_p !== undefined) {
              expect(typeof translated.top_p).toBe('number');
            }
            if (translated.stream !== undefined) {
              expect(typeof translated.stream).toBe('boolean');
            }
            if (translated.tools !== undefined) {
              expect(Array.isArray(translated.tools)).toBe(true);
            }
            if (translated.response_format !== undefined) {
              expect(typeof translated.response_format).toBe('object');
              expect(translated.response_format.type).toBeDefined();
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 12: Invalid Inputs Produce Validation Errors
   * 
   * Feature: response-to-chat-translation, Property 12: Invalid inputs produce validation errors
   * Validates: Requirements 5.2, 5.3
   * 
   * For any Response API request that is missing required fields or has incorrect
   * field types, the translation SHALL fail and return a validation error with a
   * descriptive message.
   */
  it(
    'Property 12: Invalid inputs produce validation errors',
    () => {
      fc.assert(
        fc.property(
          invalidResponseApiRequestArbitrary(),
          (request) => {
            // Feature: response-to-chat-translation, Property 12: Invalid inputs produce validation errors
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-12' });
            
            // Translation should fail
            expect(result.success).toBe(false);
            
            // Should have error message
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
            
            // Should not have translated output
            expect(result.translated).toBeUndefined();
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );

  /**
   * Property 13: Message Tool Calls Are Preserved
   * 
   * Feature: response-to-chat-translation, Property 13: Message tool calls are preserved
   * Validates: Requirements 9.2, 9.3
   * 
   * For any Response API request where input messages contain tool_calls or
   * function_calls fields, the translated Chat Completions messages SHALL preserve
   * those fields with identical structure (both formats use the same tool call structure).
   */
  it(
    'Property 13: Message tool calls are preserved',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            input: fc.array(
              fc.record({
                role: fc.constantFrom('assistant', 'tool'),
                content: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
                tool_calls: fc.option(
                  fc.array(
                    fc.record({
                      id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                      type: fc.constant('function'),
                      function: fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        arguments: fc.string()
                      })
                    }),
                    { minLength: 1, maxLength: 3 }
                  ),
                  { nil: undefined }
                ),
                function_call: fc.option(
                  fc.record({
                    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    arguments: fc.string()
                  }),
                  { nil: undefined }
                )
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          (request) => {
            // Feature: response-to-chat-translation, Property 13: Message tool calls are preserved
            
            const result = translateResponseToChat(request, { requestId: 'test-prop-13' });
            expect(result.success).toBe(true);
            
            const translated = result.translated;
            
            // Messages with tool_calls must be preserved
            for (let i = 0; i < request.input.length; i++) {
              const originalMessage = request.input[i];
              const translatedMessage = translated.messages[i];
              
              if (originalMessage.tool_calls !== undefined) {
                expect(translatedMessage.tool_calls).toEqual(originalMessage.tool_calls);
              }
              
              if (originalMessage.function_call !== undefined) {
                expect(translatedMessage.function_call).toEqual(originalMessage.function_call);
              }
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    },
    getTestTimeout('property')
  );
});

/**
 * Unit Tests for Edge Cases and Error Conditions
 * 
 * These tests validate specific edge cases and error scenarios that should be
 * handled gracefully by the translation logic. Following TDD methodology, these
 * tests are written FIRST and should FAIL until the implementation is complete.
 * 
 * Requirements: 6.1, 6.5, 6.6
 */
describe('Response API to Chat Completions Translation - Edge Cases and Error Conditions', () => {
  
  /**
   * Edge Case: Empty input string handling
   * Should return validation error
   */
  it('should return validation error for empty input string', () => {
    const request = {
      model: 'gpt-4',
      input: ''
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-empty-input' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input string cannot be empty');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Empty messages array handling
   * Should return validation error
   */
  it('should return validation error for empty messages array', () => {
    const request = {
      model: 'gpt-4',
      input: []
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-empty-messages' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input messages array cannot be empty');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Null input value handling
   * Should return validation error
   */
  it('should return validation error for null input value', () => {
    const request = {
      model: 'gpt-4',
      input: null
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-null-input' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input field is required');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Invalid input type handling
   * Should return validation error when input is not string or array
   */
  it('should return validation error for invalid input type (number)', () => {
    const request = {
      model: 'gpt-4',
      input: 12345
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-invalid-input-type' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input must be a string or messages array');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for invalid input type (object)', () => {
    const request = {
      model: 'gpt-4',
      input: { text: 'hello' }
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-invalid-input-object' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input must be a string or messages array');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Missing model field
   * Should return validation error
   */
  it('should return validation error for missing model field', () => {
    const request = {
      input: 'Hello, world!'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-missing-model' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Model field is required');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Empty model string
   * Should return validation error
   */
  it('should return validation error for empty model string', () => {
    const request = {
      model: '',
      input: 'Hello, world!'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-empty-model' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Model field is required and must be a non-empty string');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for whitespace-only model string', () => {
    const request = {
      model: '   ',
      input: 'Hello, world!'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-whitespace-model' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Model field is required and must be a non-empty string');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Invalid message structure (missing role)
   * Should return validation error
   */
  it('should return validation error for message missing role field', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { content: 'Hello, world!' }
      ]
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-missing-role' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Message at index 0 is invalid: must have role and content fields');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Invalid message structure (missing content)
   * Should return validation error
   */
  it('should return validation error for message missing content field', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { role: 'user' }
      ]
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-missing-content' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Message at index 0 is invalid: must have role and content fields');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Invalid message role
   * Should return validation error when role is not in allowed list
   */
  it('should return validation error for invalid message role', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { role: 'admin', content: 'Hello, world!' }
      ]
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-invalid-role' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Invalid role 'admin' at index 0");
    expect(result.error).toContain('Must be one of: system, user, assistant, developer, tool');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Invalid message content type
   * Should return validation error when content is not a string
   */
  it('should return validation error for non-string message content (number)', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { role: 'user', content: 12345 }
      ]
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-invalid-content-type' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Message content must be a string, got number at index 0');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for non-string message content (object)', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { role: 'user', content: { text: 'hello' } }
      ]
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-invalid-content-object' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Message content must be a string, got object at index 0');
    expect(result.translated).toBeUndefined();
  });

  /**
   * Edge Case: Instructions prepending with string input
   * Should prepend instructions as system message before user message
   */
  it('should prepend instructions as system message with string input', () => {
    const request = {
      model: 'gpt-4',
      input: 'What is the weather?',
      instructions: 'You are a helpful weather assistant.'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-instructions-string' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    expect(result.translated.messages).toHaveLength(2);
    
    // First message should be system with instructions
    expect(result.translated.messages[0].role).toBe('system');
    expect(result.translated.messages[0].content).toBe('You are a helpful weather assistant.');
    
    // Second message should be user with input
    expect(result.translated.messages[1].role).toBe('user');
    expect(result.translated.messages[1].content).toBe('What is the weather?');
  });

  /**
   * Edge Case: Instructions prepending with messages array input
   * Should prepend instructions as system message before existing messages
   */
  it('should prepend instructions as system message with messages array input', () => {
    const request = {
      model: 'gpt-4',
      input: [
        { role: 'user', content: 'What is the weather?' },
        { role: 'assistant', content: 'I can help with that.' }
      ],
      instructions: 'You are a helpful weather assistant.'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-instructions-messages' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    expect(result.translated.messages).toHaveLength(3);
    
    // First message should be system with instructions
    expect(result.translated.messages[0].role).toBe('system');
    expect(result.translated.messages[0].content).toBe('You are a helpful weather assistant.');
    
    // Remaining messages should be from input array
    expect(result.translated.messages[1]).toEqual({ role: 'user', content: 'What is the weather?' });
    expect(result.translated.messages[2]).toEqual({ role: 'assistant', content: 'I can help with that.' });
  });

  /**
   * Edge Case: text.format mapping to response_format.type
   * Should map text.format to response_format.type correctly
   */
  it('should map text.format to response_format.type', () => {
    const request = {
      model: 'gpt-4',
      input: 'Generate JSON output',
      text: {
        format: 'json_object'
      }
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-text-format' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    
    // Should have response_format with type
    expect(result.translated.response_format).toBeDefined();
    expect(result.translated.response_format.type).toBe('json_object');
    
    // Should not have text field
    expect(result.translated).not.toHaveProperty('text');
  });

  it('should map text.format "text" to response_format.type', () => {
    const request = {
      model: 'gpt-4',
      input: 'Generate text output',
      text: {
        format: 'text'
      }
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-text-format-text' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    
    // Should have response_format with type
    expect(result.translated.response_format).toBeDefined();
    expect(result.translated.response_format.type).toBe('text');
    
    // Should not have text field
    expect(result.translated).not.toHaveProperty('text');
  });

  /**
   * Edge Case: thread_id preservation as unknown field (PoC limitation)
   * Should preserve thread_id as unknown field but not process it
   */
  it('should preserve thread_id as unknown field', () => {
    const request = {
      model: 'gpt-4',
      input: 'Continue the conversation',
      thread_id: 'thread_abc123'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-thread-id' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    
    // thread_id should be preserved as unknown field
    expect(result.translated.thread_id).toBe('thread_abc123');
    
    // Should be listed in unknownFields array
    expect(result.unknownFields).toContain('thread_id');
  });

  /**
   * Edge Case: max_output_tokens to max_tokens field rename
   * Should rename max_output_tokens to max_tokens
   */
  it('should rename max_output_tokens to max_tokens', () => {
    const request = {
      model: 'gpt-4',
      input: 'Generate a response',
      max_output_tokens: 1000
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-max-tokens-rename' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    
    // Should have max_tokens field
    expect(result.translated.max_tokens).toBe(1000);
    
    // Should NOT have max_output_tokens field
    expect(result.translated).not.toHaveProperty('max_output_tokens');
  });

  it('should handle max_output_tokens with other parameters', () => {
    const request = {
      model: 'gpt-4',
      input: 'Generate a response',
      max_output_tokens: 2000,
      temperature: 0.7,
      top_p: 0.9
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-max-tokens-with-params' });
    
    expect(result.success).toBe(true);
    expect(result.translated).toBeDefined();
    
    // Should have max_tokens field
    expect(result.translated.max_tokens).toBe(2000);
    
    // Should NOT have max_output_tokens field
    expect(result.translated).not.toHaveProperty('max_output_tokens');
    
    // Other parameters should be preserved
    expect(result.translated.temperature).toBe(0.7);
    expect(result.translated.top_p).toBe(0.9);
  });

  /**
   * Additional Edge Cases: Request validation
   */
  it('should return validation error for non-object request', () => {
    const request = 'not an object';
    
    const result = translateResponseToChat(request, { requestId: 'test-non-object' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Request must be a valid object');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for null request', () => {
    const request = null;
    
    const result = translateResponseToChat(request, { requestId: 'test-null-request' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Request must be a valid object');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for undefined request', () => {
    const request = undefined;
    
    const result = translateResponseToChat(request, { requestId: 'test-undefined-request' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Request must be a valid object');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for missing input field', () => {
    const request = {
      model: 'gpt-4'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-missing-input' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input field is required');
    expect(result.translated).toBeUndefined();
  });

  it('should return validation error for non-string model field', () => {
    const request = {
      model: 12345,
      input: 'Hello, world!'
    };
    
    const result = translateResponseToChat(request, { requestId: 'test-non-string-model' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Model field is required and must be a non-empty string');
    expect(result.translated).toBeUndefined();
  });
});

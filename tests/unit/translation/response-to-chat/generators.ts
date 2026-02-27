/**
 * Property-based test generators for Response API to Chat Completions translation
 * 
 * This module provides fast-check arbitraries for generating valid Response API requests,
 * message objects, and tool definitions for property-based testing.
 */

import fc from 'fast-check';

/**
 * Valid message roles per OpenAI API specification
 */
const VALID_ROLES = ['system', 'user', 'assistant', 'developer', 'tool'] as const;

/**
 * Generate a valid message object
 * 
 * Message format is identical in both Response API and Chat Completions API
 */
export function messageArbitrary(): fc.Arbitrary<{
  role: string;
  content: string;
  tool_calls?: Array<Record<string, unknown>>;
  function_call?: Record<string, unknown>;
}> {
  return fc.record({
    role: fc.constantFrom(...VALID_ROLES),
    content: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    // Optional tool_calls (same format in both APIs)
    tool_calls: fc.option(
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('function'),
          function: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            arguments: fc.string()
          })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      { nil: undefined }
    ),
    // Optional function_call (legacy, same format in both APIs)
    function_call: fc.option(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        arguments: fc.string()
      }),
      { nil: undefined }
    )
  });
}

/**
 * Generate a valid tool definition
 * 
 * Tool format is identical in both Response API and Chat Completions API
 */
export function toolArbitrary(): fc.Arbitrary<{
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}> {
  return fc.record({
    type: fc.constant('function'),
    function: fc.record({
      name: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      parameters: fc.option(
        fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.record({
              type: fc.constantFrom('string', 'number', 'boolean', 'array', 'object'),
              description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
            })
          ),
          required: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
            { nil: undefined }
          )
        }),
        { nil: undefined }
      )
    })
  });
}

/**
 * Generate a valid Response API request
 * 
 * Generates requests with all possible field combinations for comprehensive testing
 */
export function responseApiRequestArbitrary(): fc.Arbitrary<{
  model: string;
  input?: string | Array<Record<string, unknown>>;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string | Record<string, unknown>;
  text?: { format?: string };
  metadata?: Record<string, unknown>;
  thread_id?: string;
  [key: string]: unknown;
}> {
  return fc.record({
    // Required fields
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    
    // Input is REQUIRED - can be string or messages array
    input: fc.oneof(
      fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
      fc.array(messageArbitrary(), { minLength: 1, maxLength: 10 })
    ),
    
    // Optional instructions (prepended as system message)
    instructions: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
    
    // Optional standard parameters
    temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
    max_output_tokens: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
    top_p: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    stream: fc.option(fc.boolean(), { nil: undefined }),
    
    // Optional tools and tool_choice (same format in both APIs)
    tools: fc.option(
      fc.array(toolArbitrary(), { minLength: 1, maxLength: 5 }),
      { nil: undefined }
    ),
    tool_choice: fc.option(
      fc.oneof(
        fc.constantFrom('none', 'auto', 'required'),
        fc.record({
          type: fc.constant('function'),
          function: fc.record({
            name: fc.string({ minLength: 1, maxLength: 64 })
          })
        })
      ),
      { nil: undefined }
    ),
    
    // Optional text format (maps to response_format.type)
    text: fc.option(
      fc.record({
        format: fc.option(fc.constantFrom('text', 'json_object'), { nil: undefined })
      }),
      { nil: undefined }
    ),
    
    // Optional metadata (same in both APIs)
    metadata: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.oneof(
          fc.string({ maxLength: 100 }),
          fc.integer(),
          fc.boolean()
        )
      ),
      { nil: undefined }
    ),
    
    // Optional thread_id (PoC: preserved as unknown field, not processed)
    thread_id: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
  }).filter(req => {
    // Filter out cases where instructions is present AND input is a messages array
    // with ANY system message. This avoids round-trip ambiguity because:
    // - Response→Chat: instructions becomes first system message
    // - Chat→Response: system messages stay in messages array (not extracted to instructions)
    // This asymmetry breaks round-trip equivalence.
    if (req.instructions && Array.isArray(req.input) && req.input.length > 0) {
      const hasSystemMessage = req.input.some((msg: unknown) => {
        if (typeof msg === 'object' && msg !== null) {
          const message = msg as { role?: string };
          return message.role === 'system';
        }
        return false;
      });
      if (hasSystemMessage) {
        return false; // Skip: instructions + system message = round-trip ambiguity
      }
    }
    return true;
  });
}

/**
 * Generate a Response API request with required fields only
 * 
 * Useful for testing minimal valid requests
 */
export function minimalResponseApiRequestArbitrary(): fc.Arbitrary<{
  model: string;
  input: string | Array<Record<string, unknown>>;
}> {
  return fc.record({
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    input: fc.oneof(
      fc.string({ minLength: 1, maxLength: 1000 }),
      fc.array(messageArbitrary(), { minLength: 1, maxLength: 10 })
    )
  });
}

/**
 * Generate a Response API request with string input
 * 
 * Useful for testing string → messages array conversion
 */
export function responseApiRequestWithStringInputArbitrary(): fc.Arbitrary<{
  model: string;
  input: string;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  stream?: boolean;
}> {
  return fc.record({
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    input: fc.string({ minLength: 1, maxLength: 1000 }),
    instructions: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
    temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
    max_output_tokens: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
    top_p: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    stream: fc.option(fc.boolean(), { nil: undefined })
  });
}

/**
 * Generate a Response API request with messages array input
 * 
 * Useful for testing messages array pass-through
 */
export function responseApiRequestWithMessagesInputArbitrary(): fc.Arbitrary<{
  model: string;
  input: Array<Record<string, unknown>>;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  stream?: boolean;
}> {
  return fc.record({
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    input: fc.array(messageArbitrary(), { minLength: 1, maxLength: 10 }),
    instructions: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
    temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
    max_output_tokens: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
    top_p: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    stream: fc.option(fc.boolean(), { nil: undefined })
  });
}

/**
 * Generate a Response API request with instructions
 * 
 * Useful for testing instructions prepending as system message
 */
export function responseApiRequestWithInstructionsArbitrary(): fc.Arbitrary<{
  model: string;
  input: string | Array<Record<string, unknown>>;
  instructions: string;
  temperature?: number;
}> {
  return fc.record({
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    input: fc.oneof(
      fc.string({ minLength: 1, maxLength: 1000 }),
      fc.array(messageArbitrary(), { minLength: 1, maxLength: 10 })
    ),
    instructions: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined })
  });
}

/**
 * Generate a Response API request with unknown fields
 * 
 * Useful for testing forward compatibility
 * 
 * Note: Filters out undefined values to simulate JSON serialization behavior.
 * In real HTTP requests, undefined values cannot exist in JSON payloads.
 */
export function responseApiRequestWithUnknownFieldsArbitrary(): fc.Arbitrary<{
  model: string;
  input: string | Array<Record<string, unknown>>;
  [key: string]: unknown;
}> {
  return fc.record({
    model: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    input: fc.oneof(
      fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
      fc.array(messageArbitrary(), { minLength: 1, maxLength: 10 })
    ),
    // Add 1-3 unknown fields
    unknown_field_1: fc.option(fc.string(), { nil: undefined }),
    unknown_field_2: fc.option(fc.integer(), { nil: undefined }),
    unknown_field_3: fc.option(fc.boolean(), { nil: undefined })
  }).map(req => {
    // Remove undefined fields to simulate JSON serialization
    // In real HTTP requests, undefined values are omitted during JSON.stringify()
    const cleaned: Record<string, unknown> = {};
    for (const key in req) {
      if (req[key] !== undefined) {
        cleaned[key] = req[key];
      }
    }
    return cleaned as typeof req;
  });
}

/**
 * Generate an invalid Response API request (for error testing)
 * 
 * Generates requests with various validation errors
 */
export function invalidResponseApiRequestArbitrary(): fc.Arbitrary<Record<string, unknown>> {
  return fc.oneof(
    // Missing model
    fc.record({
      input: fc.string({ minLength: 1 })
    }),
    // Empty model
    fc.record({
      model: fc.constant(''),
      input: fc.string({ minLength: 1 })
    }),
    // Missing input
    fc.record({
      model: fc.string({ minLength: 1 })
    }),
    // Empty input string
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant('')
    }),
    // Empty messages array
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant([])
    }),
    // Invalid input type
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.integer()
    }),
    // Invalid message structure (missing role)
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant([{ content: 'Hello' }])
    }),
    // Invalid message structure (missing content)
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant([{ role: 'user' }])
    }),
    // Invalid message role
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant([{ role: 'invalid_role', content: 'Hello' }])
    }),
    // Invalid message content type
    fc.record({
      model: fc.string({ minLength: 1 }),
      input: fc.constant([{ role: 'user', content: 123 }])
    })
  );
}

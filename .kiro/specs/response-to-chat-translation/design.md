# Design Document: Response API to Chat Completions Request Translation

## Overview

This design document specifies the implementation of Response API to Chat Completions request translation for the OpenAI Adapter. This feature completes the bidirectional request translation capability by implementing the reverse direction of the existing Chat→Response translation.

The Response→Chat request translator converts incoming Response API format requests into Chat Completions format for upstream processing. This enables clients using the Response API protocol to communicate with Chat Completions endpoints through the adapter, completing the symmetric bidirectional translation architecture.

The implementation follows Clean Architecture principles with clear layer separation, implements the RequestTranslator interface for dependency injection, and uses Test-Driven Development (TDD) methodology with comprehensive property-based testing.

### State Management Context

**Critical Architectural Consideration**: This translation direction involves converting from a stateful protocol (Response API) to a stateless protocol (Chat Completions):

**Response API (Stateful)**:
- Maintains conversation state server-side via `thread_id`
- Each request references a thread that persists conversation history
- Server manages message history and context
- Client only needs to send new messages, not full history

**Chat Completions API (Stateless)**:
- Each request is independent and self-contained
- Full conversation history must be included in every request via `messages[]` array
- No server-side state is maintained between requests
- Client is responsible for managing conversation context

**Adapter State Management for Response → Chat Translation**:
- The adapter itself remains stateless (no conversation state stored in adapter)
- When a Response API request contains a `thread_id`, the adapter must retrieve the full thread history from the upstream Response API to construct a complete stateless Chat Completions request
- The adapter acts as a protocol translator only; state retrieval is delegated to upstream APIs
- This design maintains the adapter's stateless architecture while enabling protocol translation

**PoC Scope Limitation**: 
- The current PoC implementation focuses on request field mapping only
- Thread history retrieval from upstream Response API is out of scope for this phase
- The adapter will translate request fields but will not fetch thread history
- Future enhancement: Add thread history retrieval capability when `thread_id` is present

## Architecture

### Layer Structure

Following Clean Architecture principles, the implementation is organized into distinct layers:

**Layer 1: Entities (Core Domain)**
- Location: `src/translation/types.ts`
- Contains: Request/response type definitions, translation result types
- Dependencies: None (innermost layer)

**Layer 2: Use Cases (Application Business Rules)**
- Location: `src/translation/response-to-chat/request.ts`
- Contains: Core translation logic, field mapping rules, validation logic
- Dependencies: Only Entities layer
- Responsibilities: Transform Response API requests to Chat Completions format

**Layer 3: Interface Adapters**
- Location: `src/translation/response-to-chat/request-translator.ts`
- Contains: RequestTranslator interface implementation, adapter wrapper
- Dependencies: Use Cases and Entities layers
- Responsibilities: Adapt translation logic to RequestTranslator interface

**Layer 4: Frameworks & Drivers**
- Location: `src/handlers/translation.handler.ts`, `src/handlers/routing.handler.ts`
- Contains: HTTP request handling, routing decisions
- Dependencies: All inner layers
- Responsibilities: Orchestrate translation operations, handle HTTP concerns

### SOLID Principles Compliance

**Single Responsibility Principle (SRP)**
- Translation logic (`request.ts`): Only handles field mapping and transformation
- Translator adapter (`request-translator.ts`): Only adapts translation to interface
- Translation handler: Only orchestrates translation with logging
- Routing handler: Only makes routing decisions

**Open/Closed Principle (OCP)**
- New translation directions can be added without modifying existing translators
- RequestTranslator interface allows new implementations without changing consumers

**Liskov Substitution Principle (LSP)**
- ResponseToChatRequestTranslator is substitutable for any RequestTranslator
- All translators implement the same interface contract

**Interface Segregation Principle (ISP)**
- RequestTranslator interface is separate from ResponseTranslator interface
- Clients depend only on the methods they use

**Dependency Inversion Principle (DIP)**
- Handlers depend on RequestTranslator interface, not concrete implementations
- Translation logic is injected via dependency injection

## Components and Interfaces

### Core Translation Function

**File**: `src/translation/response-to-chat/request.ts`

**Function Signature**:
```typescript
export function translateResponseToChat(
  request: unknown,
  options: ResponseToChatTranslationOptions
): ResponseToChatTranslationResult
```

**Responsibilities**:
- Validate input is a valid Response API request object
- Extract and validate required fields (model, input)
- Map Response API fields to Chat Completions equivalents
- Handle input field conversion (string → messages array)
- Prepend instructions as system message if present
- Preserve unknown fields for forward compatibility
- Return translation result with success/error status

**Field Mapping Strategy**:
- `model` → `model` (direct copy)
- `input` (string) → `messages` (array with single user message)
- `input` (array) → `messages` (direct copy, same format)
- `instructions` → prepend as system message in `messages` array
- `temperature` → `temperature` (direct copy)
- `max_output_tokens` → `max_tokens` (field rename)
- `top_p` → `top_p` (direct copy)
- `stream` → `stream` (direct copy)
- `tools` → `tools` (direct copy, same format)
- `tool_choice` → `tool_choice` (direct copy, same format)
- `text.format` → `response_format.type` (structure transformation)
- `metadata` → `metadata` (direct copy)
- `thread_id` → Not mapped (PoC limitation: thread history retrieval out of scope)
- Unknown fields → pass through (forward compatibility)

**State Management Handling**:
- If `thread_id` is present in the Response API request, it will be preserved as an unknown field
- The adapter will NOT retrieve thread history from upstream in this PoC phase
- The translated Chat Completions request will only contain messages from the `input` field
- Future enhancement: Implement thread history retrieval to construct complete message history

### Validation Function

**Function Signature**:
```typescript
export function isResponseApiRequest(request: unknown): boolean
```

**Responsibilities**:
- Validate request is an object
- Validate required fields exist (model, input)
- Validate field types are correct
- Return boolean indicating validity

### Translator Adapter Class

**File**: `src/translation/response-to-chat/request-translator.ts`

**Class Definition**:
```typescript
export class ResponseToChatRequestTranslator 
  implements RequestTranslator<ResponseApiRequest, ChatCompletionsRequest>
```

**Methods**:
- `translateRequest(request, options)`: Delegates to `translateResponseToChat`
- `isValidRequest(request)`: Delegates to `isResponseApiRequest`

**Factory Function**:
```typescript
export function createResponseToChatRequestTranslator(): ResponseToChatRequestTranslator
```

### Translation Handler Integration

**File**: `src/handlers/translation.handler.ts`

**New Function**:
```typescript
export function handleResponseToChatTranslation(
  logger: FastifyInstance['log'],
  requestId: string,
  request: unknown,
  translator?: RequestTranslator
): TranslationHandlerResult
```

**Responsibilities**:
- Accept optional translator for dependency injection
- Use default ResponseToChatRequestTranslator if not provided
- Delegate to orchestrateRequestTranslation
- Return simplified result for HTTP layer

### Routing Handler Integration

**File**: `src/handlers/routing.handler.ts`

**Modification**: Add conditional branch for response→chat_completions translation

**Location**: In the translation decision block, after the existing chat→response branch

**Logic**:
```typescript
if (
  routingResult.sourceFormat === 'response' &&
  routingResult.targetFormat === 'chat_completions'
) {
  // Perform Response→Chat translation
  const translationResult = handleResponseToChatTranslation(
    request.log,
    request.id,
    request.body
  );

  if (!translationResult.success) {
    // Handle translation error
    return reply.code(400).send({
      error: 'Translation Error',
      message: translationResult.error,
      requestId: request.id
    });
  }

  // Forward translated request to pass-through handler
  const translatedRequest = {
    ...request,
    body: translationResult.translated
  };

  return chatCompletionsHandler(translatedRequest, reply);
}
```

## Data Models

### Input Type: ResponseApiRequest

```typescript
interface ResponseApiRequest {
  model: string;                                    // Required
  input?: string | Array<Record<string, unknown>>;  // Optional, string or messages array
  instructions?: string;                            // Optional, prepended as system message
  temperature?: number;                             // Optional
  max_output_tokens?: number;                       // Optional
  top_p?: number;                                   // Optional
  stream?: boolean;                                 // Optional
  tools?: Array<Record<string, unknown>>;           // Optional
  tool_choice?: string | Record<string, unknown>;   // Optional
  text?: {                                          // Optional
    format?: string;
  };
  metadata?: Record<string, unknown>;               // Optional
  thread_id?: string;                               // Optional, preserved as unknown field (PoC: no history retrieval)
  [key: string]: unknown;                           // Unknown fields
}
```

**Note on thread_id**: In the PoC implementation, `thread_id` is treated as an unknown field and preserved but not used for thread history retrieval. Future enhancement will implement thread history fetching from upstream Response API.

### Output Type: ChatCompletionsRequest

```typescript
interface ChatCompletionsRequest {
  model: string;                                    // Required
  messages: Array<{                                 // Required
    role: string;
    content: string;
  }>;
  temperature?: number;                             // Optional
  max_tokens?: number;                              // Optional
  top_p?: number;                                   // Optional
  stream?: boolean;                                 // Optional
  tools?: Array<Record<string, unknown>>;           // Optional
  tool_choice?: string | Record<string, unknown>;   // Optional
  response_format?: {                               // Optional
    type: string;
  };
  metadata?: Record<string, unknown>;               // Optional
  [key: string]: unknown;                           // Unknown fields
}
```

### Translation Result Type

```typescript
interface ResponseToChatTranslationResult {
  success: boolean;
  translated?: ChatCompletionsRequest;
  error?: string;
  unknownFields: string[];
}
```

### Translation Options Type

```typescript
interface ResponseToChatTranslationOptions {
  requestId: string;
  strict?: boolean;  // If true, fail on unknown fields
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Round-trip Translation Preserves Semantic Equivalence

*For any* valid Response API request, translating it to Chat Completions format and then back to Response API format SHALL produce a semantically equivalent request where:
- The model field is identical
- The input content is preserved (whether string or messages array)
- All optional parameters (temperature, max_output_tokens/max_tokens, top_p, stream) have equivalent values
- Tools and tool_choice are preserved
- Metadata is preserved
- Unknown fields are preserved

**Validates: Requirements 1.5, 2.8, 4.3, 9.5, 10.5**

### Property 2: Standard Parameter Mapping Preserves Values

*For any* Response API request containing standard parameters (model, temperature, max_output_tokens, top_p, stream), the translated Chat Completions request SHALL contain the same values mapped to their equivalent fields:
- model → model (identical)
- temperature → temperature (identical)
- max_output_tokens → max_tokens (identical value, different name)
- top_p → top_p (identical)
- stream → stream (identical)

**Validates: Requirements 2.1, 2.4, 2.5, 2.6, 2.7**

### Property 3: String Input Converts to Single User Message

*For any* Response API request where input is a non-empty string, the translated Chat Completions request SHALL contain a messages array with exactly one message having role "user" and content equal to the input string.

**Validates: Requirements 2.2**

### Property 4: Messages Array Input Passes Through Directly

*For any* Response API request where input is a messages array, the translated Chat Completions request SHALL contain the same messages array (both formats use identical message structure per OpenAI documentation).

**Validates: Requirements 2.2, 9.1**

### Property 5: Instructions Prepend as System Message

*For any* Response API request containing an instructions field and an input field, the translated Chat Completions messages array SHALL have the instructions as the first message with role "system", followed by the input messages.

**Validates: Requirements 2.3**

### Property 6: Tools and Tool Choice Pass Through

*For any* Response API request containing tools and/or tool_choice fields, the translated Chat Completions request SHALL contain identical tools and tool_choice values (both formats use the same structure per OpenAI documentation).

**Validates: Requirements 3.1, 3.2, 10.1, 10.2**

### Property 7: Text Format Maps to Response Format Type

*For any* Response API request containing a text.format field, the translated Chat Completions request SHALL contain a response_format object with type field equal to the text.format value.

**Validates: Requirements 3.3**

### Property 8: Metadata Preserves Key-Value Pairs

*For any* Response API request containing a metadata object, the translated Chat Completions request SHALL contain an identical metadata object with all key-value pairs preserved.

**Validates: Requirements 3.4**

### Property 9: Absent Optional Fields Are Omitted

*For any* Response API request where optional fields (temperature, max_output_tokens, top_p, stream, tools, tool_choice, text, metadata) are absent, the translated Chat Completions request SHALL not contain the corresponding fields.

**Validates: Requirements 3.5**

### Property 10: Unknown Fields Are Preserved

*For any* Response API request containing fields not in the known mapping, the translated Chat Completions request SHALL contain those same unknown fields with identical values, enabling forward compatibility with future API versions.

**Validates: Requirements 4.1, 4.2**

### Property 11: Translated Output Is Valid Chat Completions Format

*For any* valid Response API request that translates successfully, the resulting Chat Completions request SHALL conform to the Chat Completions schema with:
- A non-empty string model field
- A non-empty messages array
- Each message having a valid role and string content
- All optional fields having correct types

**Validates: Requirements 5.1**

### Property 12: Invalid Inputs Produce Validation Errors

*For any* Response API request that is missing required fields (model, input) or has incorrect field types, the translation SHALL fail and return a validation error with a descriptive message.

**Validates: Requirements 5.2, 5.3**

### Property 13: Message Tool Calls Are Preserved

*For any* Response API request where input messages contain tool_calls or function_calls fields, the translated Chat Completions messages SHALL preserve those fields with identical structure (both formats use the same tool call structure).

**Validates: Requirements 9.2, 9.3**

## Error Handling

### Validation Errors

The translator SHALL return validation errors in the following cases:

1. **Invalid Request Type**: Request is not an object or is null
   - Error: "Request must be a valid object"
   - HTTP Status: 400 Bad Request

2. **Missing Model Field**: Model field is absent, not a string, or empty
   - Error: "Model field is required and must be a non-empty string"
   - HTTP Status: 400 Bad Request

3. **Missing Input Field**: Input field is absent or null
   - Error: "Input field is required"
   - HTTP Status: 400 Bad Request

4. **Invalid Input Type**: Input is neither a string nor an array
   - Error: "Input must be a string or messages array"
   - HTTP Status: 400 Bad Request

5. **Empty Input String**: Input is an empty string
   - Error: "Input string cannot be empty"
   - HTTP Status: 400 Bad Request

6. **Empty Messages Array**: Input is an empty array
   - Error: "Input messages array cannot be empty"
   - HTTP Status: 400 Bad Request

7. **Invalid Message Structure**: Messages array contains invalid message objects
   - Error: "Message at index {i} is invalid: must have role and content fields"
   - HTTP Status: 400 Bad Request

8. **Invalid Message Role**: Message has an invalid role value
   - Error: "Invalid role '{role}' at index {i}. Must be one of: system, user, assistant, developer, tool"
   - HTTP Status: 400 Bad Request

9. **Invalid Message Content**: Message content is not a string
   - Error: "Message content must be a string, got {type} at index {i}"
   - HTTP Status: 400 Bad Request

### Error Response Format

All validation errors SHALL be returned in a consistent format:

```typescript
{
  success: false,
  error: string,        // Descriptive error message
  unknownFields: []     // Empty array for failed translations
}
```

### Error Handling Patterns

The implementation SHALL follow the same error handling patterns as the existing Chat→Response translator:

1. **Early Validation**: Validate request structure before attempting translation
2. **Descriptive Messages**: Provide clear, actionable error messages
3. **Graceful Degradation**: Return error results instead of throwing exceptions
4. **Consistent Format**: Use the same TranslationResult structure for all outcomes

### Logging Error Cases

The translator SHALL log errors at appropriate levels:

- **Validation Errors**: Log at `warn` level with request context
- **Translation Failures**: Log at `error` level with error details
- **Unknown Fields**: Log at `info` level for debugging

## Testing Strategy

### Test-Driven Development (TDD) Approach

The implementation SHALL follow strict TDD methodology:

1. **Red Phase**: Write failing tests first
   - Write property-based tests for each correctness property
   - Write unit tests for edge cases and error conditions
   - Verify tests fail before implementation

2. **Green Phase**: Implement minimal code to pass tests
   - Implement translation logic in `request.ts`
   - Implement translator adapter in `request-translator.ts`
   - Implement handler integration
   - Verify all tests pass

3. **Refactor Phase**: Improve code quality
   - Extract common patterns
   - Improve readability
   - Ensure SOLID compliance
   - Verify tests still pass

### PoC Scope Limitations for Testing

**Thread History Retrieval (Out of Scope)**:
- Tests will NOT cover thread history retrieval from upstream Response API
- Tests will focus on field mapping for requests with `input` field only
- `thread_id` field will be tested as an unknown field (preserved but not processed)
- Future enhancement: Add integration tests for thread history retrieval

### Dual Testing Approach

The test suite SHALL include both unit tests and property-based tests:

**Unit Tests** (for specific examples and edge cases):
- Empty input string handling
- Empty messages array handling
- Null value handling
- Missing optional fields
- Instructions prepending with various input types
- Text format mapping edge cases
- Error message formatting
- thread_id preservation as unknown field

**Property-Based Tests** (for universal properties):
- All 13 correctness properties listed above
- Minimum 100 iterations per property test
- Random input generation for comprehensive coverage

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript property-based testing

**Test Structure**:
```typescript
import fc from 'fast-check';

describe('Property: Round-trip Translation', () => {
  it('should preserve semantic equivalence for all valid Response API requests', () => {
    fc.assert(
      fc.property(
        responseApiRequestArbitrary(),
        (request) => {
          // Feature: response-to-chat-translation, Property 1: Round-trip preserves semantic equivalence
          const chatResult = translateResponseToChat(request, { requestId: 'test' });
          expect(chatResult.success).toBe(true);
          
          const backResult = translateChatToResponse(chatResult.translated, { requestId: 'test' });
          expect(backResult.success).toBe(true);
          
          // Verify semantic equivalence
          expect(backResult.translated.model).toBe(request.model);
          // ... additional equivalence checks
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test Tagging**: Each property test SHALL include a comment tag:
```typescript
// Feature: response-to-chat-translation, Property {number}: {property description}
```

### Test Coverage Requirements

- **Translation Logic**: 100% coverage of `request.ts`
- **Translator Adapter**: 100% coverage of `request-translator.ts`
- **Validation Logic**: 100% coverage of `isResponseApiRequest`
- **Error Paths**: All error conditions tested
- **Edge Cases**: Empty arrays, null values, missing fields

### Integration Tests

**End-to-End Flow Tests**:
1. Response API request → routing handler → translation → Chat Completions upstream
2. Verify translated request reaches upstream correctly
3. Verify response translation back to Response API format
4. Verify pass-through when source and target match

**Regression Tests**:
1. Verify existing Chat→Response translation still works
2. Verify routing handler doesn't break existing functionality
3. Verify pass-through handler still works for both endpoints

### Test Organization

```
tests/
├── unit/
│   └── translation/
│       └── response-to-chat/
│           ├── request.test.ts              # Core translation logic
│           ├── request-translator.test.ts   # Translator adapter
│           └── validation.test.ts           # Validation function
├── integration/
│   ├── smoke/
│   │   └── response-to-chat-translation.test.ts  # Basic connectivity
│   └── regression/
│       └── bidirectional-translation.test.ts     # Full round-trip flows
```

### Test Execution Commands

- `npm test` - Run all unit tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run smoke + regression tests
- `npm run test:ci` - Full CI pipeline (lint, unit, build, docker, integration)

### Generators for Property-Based Testing

**Custom Arbitraries** (to be implemented):

```typescript
// Generate valid Response API requests
function responseApiRequestArbitrary(): fc.Arbitrary<ResponseApiRequest> {
  return fc.record({
    model: fc.string({ minLength: 1 }),
    input: fc.oneof(
      fc.string({ minLength: 1 }),
      fc.array(messageArbitrary(), { minLength: 1 })
    ),
    instructions: fc.option(fc.string()),
    temperature: fc.option(fc.double({ min: 0, max: 2 })),
    max_output_tokens: fc.option(fc.integer({ min: 1, max: 4096 })),
    top_p: fc.option(fc.double({ min: 0, max: 1 })),
    stream: fc.option(fc.boolean()),
    tools: fc.option(fc.array(toolArbitrary())),
    tool_choice: fc.option(fc.oneof(fc.string(), fc.object())),
    text: fc.option(fc.record({ format: fc.string() })),
    metadata: fc.option(fc.dictionary(fc.string(), fc.anything())),
    thread_id: fc.option(fc.string())  // PoC: preserved as unknown field, not processed
  });
}

// Generate valid message objects
function messageArbitrary(): fc.Arbitrary<Message> {
  return fc.record({
    role: fc.constantFrom('system', 'user', 'assistant', 'developer', 'tool'),
    content: fc.string()
  });
}

// Generate tool definitions
function toolArbitrary(): fc.Arbitrary<Tool> {
  return fc.record({
    type: fc.constant('function'),
    function: fc.record({
      name: fc.string({ minLength: 1 }),
      description: fc.option(fc.string()),
      parameters: fc.object()
    })
  });
}
```

### Test Execution Order

1. **Unit Tests First**: Validate individual functions in isolation
2. **Property Tests**: Validate universal properties across many inputs
3. **Integration Tests**: Validate full request/response flows
4. **Regression Tests**: Ensure existing functionality still works

This comprehensive testing strategy ensures correctness, maintainability, and confidence in the bidirectional translation implementation.

## Future Enhancements

### Thread History Retrieval (Out of PoC Scope)

**Requirement**: When translating Response API → Chat Completions, retrieve full thread history to construct complete stateless request

**Design Approach** (for future implementation):
1. Detect presence of `thread_id` in Response API request
2. Make upstream API call to retrieve thread history: `GET /threads/{thread_id}/messages`
3. Construct complete `messages[]` array from thread history
4. Combine with new messages from `input` field
5. Translate to Chat Completions format with full conversation context

**Architectural Considerations**:
- Adapter remains stateless (no conversation state stored)
- Thread history retrieval adds latency to translation
- Caching strategy may be needed for performance
- Error handling for thread retrieval failures
- Thread not found scenarios

**Implementation Strategy**:
- Add optional `threadHistoryRetriever` interface for dependency injection
- Implement retriever adapter for OpenAI Response API
- Add configuration flag to enable/disable thread history retrieval
- Maintain backward compatibility with current field-mapping-only approach

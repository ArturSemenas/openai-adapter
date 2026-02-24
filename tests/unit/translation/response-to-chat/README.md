# Response API to Chat Completions Translation Tests

This directory contains comprehensive tests for the Response API → Chat Completions request translation feature, following Test-Driven Development (TDD) methodology with property-based testing.

## Test Structure

### Test Files

- **`generators.ts`** - Property-based test generators (fast-check arbitraries)
  - `messageArbitrary()` - Generates valid message objects
  - `toolArbitrary()` - Generates valid tool definitions
  - `responseApiRequestArbitrary()` - Generates valid Response API requests
  - `minimalResponseApiRequestArbitrary()` - Generates minimal valid requests
  - `responseApiRequestWithStringInputArbitrary()` - Generates requests with string input
  - `responseApiRequestWithMessagesInputArbitrary()` - Generates requests with messages array
  - `responseApiRequestWithInstructionsArbitrary()` - Generates requests with instructions
  - `responseApiRequestWithUnknownFieldsArbitrary()` - Generates requests with unknown fields
  - `invalidResponseApiRequestArbitrary()` - Generates invalid requests for error testing

- **`test-config.ts`** - Property-based test configuration
  - `PROPERTY_TEST_CONFIG` - Default configuration (100 iterations per property)
  - `TEST_TIMEOUTS` - Timeout settings for different test types
  - `TEST_DATA_CONSTRAINTS` - Constraints for generated test data
  - Helper functions for creating test configurations

- **`request.test.ts`** (to be created) - Core translation logic tests
  - Property-based tests for all 13 correctness properties
  - Unit tests for edge cases and error conditions
  - Validation tests for invalid inputs

- **`request-translator.test.ts`** (to be created) - Translator adapter tests
  - Tests for RequestTranslator interface implementation
  - Tests for factory function
  - Tests for delegation to core translation logic

## Property-Based Testing

### Configuration

All property tests run with a minimum of **100 iterations** per property to ensure comprehensive coverage across the input space. This is configured in `test-config.ts`:

```typescript
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  // ... other settings
};
```

### Generators

The `generators.ts` module provides fast-check arbitraries for generating valid test data:

```typescript
import { responseApiRequestArbitrary } from './generators.js';
import { PROPERTY_TEST_CONFIG } from './test-config.js';
import fc from 'fast-check';

it('should validate property', () => {
  fc.assert(
    fc.property(
      responseApiRequestArbitrary(),
      (request) => {
        // Test property
      }
    ),
    PROPERTY_TEST_CONFIG
  );
});
```

### Correctness Properties

The test suite validates 13 correctness properties:

1. **Round-trip Translation Preserves Semantic Equivalence** - Response→Chat→Response preserves meaning
2. **Standard Parameter Mapping Preserves Values** - model, temperature, max_output_tokens, top_p, stream map correctly
3. **String Input Converts to Single User Message** - String input becomes messages array with one user message
4. **Messages Array Input Passes Through Directly** - Messages array is preserved as-is
5. **Instructions Prepend as System Message** - Instructions field becomes first system message
6. **Tools and Tool Choice Pass Through** - Tools and tool_choice are preserved
7. **Text Format Maps to Response Format Type** - text.format becomes response_format.type
8. **Metadata Preserves Key-Value Pairs** - Metadata object is preserved
9. **Absent Optional Fields Are Omitted** - Missing optional fields don't appear in output
10. **Unknown Fields Are Preserved** - Unknown fields pass through for forward compatibility
11. **Translated Output Is Valid Chat Completions Format** - Output conforms to Chat Completions schema
12. **Invalid Inputs Produce Validation Errors** - Missing required fields return errors
13. **Message Tool Calls Are Preserved** - tool_calls and function_calls in messages are preserved

## Test-Driven Development (TDD)

The implementation follows strict TDD methodology:

### Red Phase (Write Failing Tests First)
1. Write property-based tests for all 13 correctness properties
2. Write unit tests for edge cases and error conditions
3. Verify all tests fail (no implementation exists yet)

### Green Phase (Implement to Pass Tests)
1. Implement core translation logic in `src/translation/response-to-chat/request.ts`
2. Implement translator adapter in `src/translation/response-to-chat/request-translator.ts`
3. Verify all tests pass

### Refactor Phase (Improve Code Quality)
1. Extract common patterns
2. Improve readability
3. Ensure SOLID compliance
4. Verify tests still pass

## Running Tests

```bash
# Run all unit tests
npm test

# Run only response-to-chat translation tests
npm test -- tests/unit/translation/response-to-chat

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Coverage Requirements

- **Translation Logic**: 100% coverage of `request.ts`
- **Translator Adapter**: 100% coverage of `request-translator.ts`
- **Validation Logic**: 100% coverage of validation functions
- **Error Paths**: All error conditions tested
- **Edge Cases**: Empty arrays, null values, missing fields

## Requirements Traceability

Each test references specific requirements from the requirements document:

- **Requirements 1.x**: Core translation functionality
- **Requirements 2.x**: Field mapping
- **Requirements 3.x**: Optional and format-specific fields
- **Requirements 4.x**: Unknown fields preservation
- **Requirements 5.x**: Validation
- **Requirements 6.x**: Test-driven development
- **Requirements 9.x**: Message format handling
- **Requirements 10.x**: Tool and function call translation

## Notes

- Property tests may take longer than unit tests due to multiple iterations (100+ per property)
- Test timeouts are configured in `test-config.ts` to accommodate property test execution time
- Generators use realistic constraints to ensure valid test data
- Invalid request generators are used for error testing
- All tests follow the same patterns as existing chat-to-response translation tests

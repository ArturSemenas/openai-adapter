---
inclusion: fileMatch
fileMatchPattern: "**/*.test.ts,**/*.spec.ts,**/tests/**"
---

# Testing Guide

## Test File Naming

- Unit tests: `*.test.ts` (co-located with source) or in `tests/unit/`
- Integration tests: `*.spec.ts` or `*.test.ts` in `tests/integration/`
- Use descriptive names that match the module being tested

## Test Structure

### Unit Tests

Unit tests should test individual functions or modules in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from './module.js';

describe('functionToTest', () => {
  it('should handle valid input correctly', () => {
    const result = functionToTest('valid-input');
    expect(result).toBe('expected-output');
  });

  it('should throw error for invalid input', () => {
    expect(() => functionToTest('invalid')).toThrow('Expected error message');
  });
});
```

### Integration Tests

Integration tests should test full request/response flows:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer({ config: testConfig });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle valid request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { /* test payload */ }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ /* expected response */ });
  });
});
```

## Mocking Best Practices

### Mock External Dependencies

- Mock HTTP calls to upstream APIs
- Mock file system operations
- Mock environment variables when needed
- Use Vitest's built-in mocking capabilities

### Don't Mock Internal Logic

- Test real implementations of your own code
- Only mock at system boundaries (HTTP, file system, etc.)
- Avoid over-mocking which can hide bugs

## Test-Driven Development (TDD) Workflow

### Mandatory TDD Process

**All new features MUST follow this workflow:**

1. **Write Failing Test First (RED)**
   - Write test that describes desired behavior
   - Test must fail (proving it tests something real)
   - Test should be minimal and focused

2. **Implement Minimum Code (GREEN)**
   - Write simplest code to make test pass
   - No extra features or optimizations
   - Focus on making the test green

3. **Refactor (REFACTOR)**
   - Clean up code while keeping tests green
   - Remove duplication
   - Improve design
   - Ensure SOLID principles

4. **Repeat**
   - Continue cycle for next feature/behavior

### TDD for Bidirectional Translation

**Example workflow for Response→Chat translation:**

```typescript
// Step 1: Write failing test
describe('translateResponseToChat', () => {
  it('should translate basic response request to chat format', () => {
    const responseRequest = {
      model: 'gpt-4',
      input: [{ role: 'user', content: 'Hello' }]
    };
    
    const result = translateResponseToChat(responseRequest);
    
    expect(result.success).toBe(true);
    expect(result.translated.model).toBe('gpt-4');
    expect(result.translated.messages).toEqual([
      { role: 'user', content: 'Hello' }
    ]);
  });
});

// Step 2: Run test (should fail - function doesn't exist yet)
// Step 3: Implement minimum code to pass
// Step 4: Refactor and improve
// Step 5: Add next test case
```

**Both directions must have tests BEFORE implementation:**
- Chat→Response request translation ✓ (already has tests)
- Response→Chat request translation ✗ (needs tests first)
- Chat→Response response translation ✗ (needs tests first)
- Response→Chat response translation ✗ (needs tests first)

## Test Coverage Goals

**Mandatory Coverage Targets:**
- **Translation logic**: 100% coverage (critical business logic)
- **Routing logic**: 100% coverage (critical decision logic)
- **Validation logic**: 100% coverage (security-critical)
- **Handlers**: 90%+ coverage
- **Overall**: 85%+ coverage

**Testing Requirements:**
- Test both success and error cases
- Test edge cases and boundary conditions
- Test validation logic thoroughly
- Test error handling and recovery
- Test bidirectional transformations (A→B and B→A)

## Test Suite Structure

### Unit Tests (Mandatory)
**Location**: `tests/unit/`

**Purpose**: Test individual functions/modules in isolation

**Requirements**:
- Mock all external dependencies
- Test both A→B and B→A translations
- Test success and error paths
- Test edge cases and boundary conditions
- Follow Arrange-Act-Assert pattern
- Use descriptive test names

**Example structure**:
```typescript
describe('TranslationModule', () => {
  describe('translateChatToResponse', () => {
    it('should translate basic chat request to response format', () => {
      // Arrange
      const chatRequest = { /* ... */ };
      
      // Act
      const result = translateChatToResponse(chatRequest);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.translated).toMatchObject({ /* ... */ });
    });
    
    it('should handle missing required fields', () => { /* ... */ });
    it('should preserve unknown fields', () => { /* ... */ });
  });
});
```

### Smoke Tests (Mandatory)
**Location**: `tests/integration/smoke/`

**Purpose**: Verify basic connectivity and functionality

**Requirements**:
- Test service starts successfully
- Test health/readiness endpoints
- Test connectivity to mock provider endpoints
- Test configuration loading
- Fast execution (< 10 seconds total)

### End-to-End (E2E) Tests (Mandatory)
**Location**: `tests/integration/`

**Purpose**: Simulate complete agent-to-router flows

**Requirements**:
- Test both protocol types (Chat Completions and Response API)
- Test bidirectional scenarios:
  - Chat request → Response upstream → Chat response
  - Response request → Chat upstream → Response response
- Test pass-through scenarios
- Test error scenarios (validation, upstream errors, timeouts)
- Use real Docker containers for upstream mocks

**Example E2E test structure**:
```typescript
describe('E2E: Chat to Response Translation', () => {
  it('should handle full chat→response→chat flow', async () => {
    // Send Chat Completions request
    const response = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: chatRequest
    });
    
    // Verify response is in Chat Completions format
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      choices: expect.any(Array),
      model: expect.any(String)
    });
  });
});
```

## Running Tests

### Local Development

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode (for TDD)
npm run test:watch

# Run smoke tests
npm run test:smoke

# Run integration tests (requires Docker)
npm run test:integration:local

# Run full CI pipeline
npm run test:ci
```

### TDD Workflow Commands

```bash
# Start TDD watch mode
npm run test:watch

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --grep "translateResponseToChat"
```

### CI/CD Pipeline

The CI pipeline runs:
1. Linting (`npm run lint`)
2. Unit tests (`npm run test:unit`)
3. TypeScript build (`npm run build`)
4. Docker image build (`npm run docker:build`)
5. Smoke tests (`npm run test:smoke`)
6. Integration/E2E tests (`npm run test:integration:docker`)

## Common Testing Patterns

### Testing Configuration Loading

- Test valid configurations
- Test invalid configurations (should fail with clear errors)
- Test missing required fields
- Test type validation (e.g., positive integers)

### Testing Request Handlers

- Test successful requests
- Test validation errors (400 responses)
- Test server errors (500 responses)
- Test rate limiting (503 responses)
- Test request ID inclusion in responses

### Testing Error Formatting

- Test that errors include request IDs
- Test that error messages are clear and actionable
- Test that sensitive information is not leaked

### Testing Health/Readiness

- Test that `/health` always returns 200
- Test that `/ready` returns 200 when config is valid
- Test that `/ready` returns 503 when config is invalid
- Test that these endpoints bypass connection limits

## Test Data Management

- Use realistic test data that matches production patterns
- Keep test data minimal but representative
- Use factories or builders for complex test objects
- Store test fixtures in `tests/fixtures/` if needed

## Debugging Tests

- Use `console.log()` or `app.log.info()` for debugging
- Run single test file: `npm test -- path/to/test.test.ts`
- Use `it.only()` to run a single test
- Use `it.skip()` to temporarily skip tests
- Check test output for detailed error messages

## Performance Testing

- Keep unit tests fast (< 100ms each)
- Integration tests can be slower but should still be reasonable
- Use `beforeAll` instead of `beforeEach` when possible
- Clean up resources in `afterAll` and `afterEach`

## Test Maintenance

- Update tests when requirements change
- Remove obsolete tests
- Refactor tests to reduce duplication
- Keep tests readable and maintainable
- Document complex test setups

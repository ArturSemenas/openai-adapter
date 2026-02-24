# Implementation Plan: Response API to Chat Completions Request Translation

## Overview

This implementation plan covers the Response API → Chat Completions request translation feature, completing the bidirectional translation capability of the OpenAI Adapter. The implementation follows Test-Driven Development (TDD) methodology with comprehensive property-based testing using fast-check, Clean Architecture principles, and SOLID compliance.

The feature translates incoming Response API format requests into Chat Completions format for upstream processing, enabling clients using the Response API protocol to communicate with Chat Completions endpoints through the adapter.

## Tasks

- [x] 1. Set up test infrastructure and property-based test generators
  - Create test file structure in tests/unit/translation/response-to-chat/
  - Implement fast-check arbitraries for generating valid Response API requests
  - Implement fast-check arbitraries for generating valid message objects
  - Implement fast-check arbitraries for generating tool definitions
  - Configure property-based test settings (minimum 100 iterations per property)
  - _Requirements: 6.1, 6.2_

- [ ] 2. Write failing property-based tests for core translation properties (TDD Red Phase)
  - [ ] 2.1 Write property test for Property 1: Round-trip translation preserves semantic equivalence
    - **Property 1: Round-trip Translation Preserves Semantic Equivalence**
    - **Validates: Requirements 1.5, 2.8, 4.3, 9.5, 10.5**
    - Test that Response→Chat→Response preserves model, input, parameters, tools, metadata, unknown fields
  
  - [ ] 2.2 Write property test for Property 2: Standard parameter mapping preserves values
    - **Property 2: Standard Parameter Mapping Preserves Values**
    - **Validates: Requirements 2.1, 2.4, 2.5, 2.6, 2.7**
    - Test that model, temperature, max_output_tokens→max_tokens, top_p, stream map correctly
  
  - [ ] 2.3 Write property test for Property 3: String input converts to single user message
    - **Property 3: String Input Converts to Single User Message**
    - **Validates: Requirements 2.2**
    - Test that string input becomes messages array with one user message
  
  - [ ] 2.4 Write property test for Property 4: Messages array input passes through directly
    - **Property 4: Messages Array Input Passes Through Directly**
    - **Validates: Requirements 2.2, 9.1**
    - Test that messages array input is preserved as-is
  
  - [ ] 2.5 Write property test for Property 5: Instructions prepend as system message
    - **Property 5: Instructions Prepend as System Message**
    - **Validates: Requirements 2.3**
    - Test that instructions field becomes first system message in messages array
  
  - [ ] 2.6 Write property test for Property 6: Tools and tool choice pass through
    - **Property 6: Tools and Tool Choice Pass Through**
    - **Validates: Requirements 3.1, 3.2, 10.1, 10.2**
    - Test that tools and tool_choice are preserved with identical structure
  
  - [ ] 2.7 Write property test for Property 7: Text format maps to response format type
    - **Property 7: Text Format Maps to Response Format Type**
    - **Validates: Requirements 3.3**
    - Test that text.format becomes response_format.type
  
  - [ ] 2.8 Write property test for Property 8: Metadata preserves key-value pairs
    - **Property 8: Metadata Preserves Key-Value Pairs**
    - **Validates: Requirements 3.4**
    - Test that metadata object is preserved with all key-value pairs
  
  - [ ] 2.9 Write property test for Property 9: Absent optional fields are omitted
    - **Property 9: Absent Optional Fields Are Omitted**
    - **Validates: Requirements 3.5**
    - Test that missing optional fields don't appear in translated output
  
  - [ ] 2.10 Write property test for Property 10: Unknown fields are preserved
    - **Property 10: Unknown Fields Are Preserved**
    - **Validates: Requirements 4.1, 4.2**
    - Test that unknown fields pass through for forward compatibility
  
  - [ ] 2.11 Write property test for Property 11: Translated output is valid Chat Completions format
    - **Property 11: Translated Output Is Valid Chat Completions Format**
    - **Validates: Requirements 5.1**
    - Test that output conforms to Chat Completions schema
  
  - [ ] 2.12 Write property test for Property 12: Invalid inputs produce validation errors
    - **Property 12: Invalid Inputs Produce Validation Errors**
    - **Validates: Requirements 5.2, 5.3**
    - Test that missing required fields and incorrect types return errors
  
  - [ ] 2.13 Write property test for Property 13: Message tool calls are preserved
    - **Property 13: Message Tool Calls Are Preserved**
    - **Validates: Requirements 9.2, 9.3**
    - Test that tool_calls and function_calls in messages are preserved
  
  - Verify all property tests fail (no implementation exists yet)
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 3. Write failing unit tests for edge cases and error conditions (TDD Red Phase)
  - Write test for empty input string handling (should return validation error)
  - Write test for empty messages array handling (should return validation error)
  - Write test for null input value handling (should return validation error)
  - Write test for invalid input type handling (not string or array)
  - Write test for missing model field (should return validation error)
  - Write test for empty model string (should return validation error)
  - Write test for invalid message structure (missing role or content)
  - Write test for invalid message role (not in allowed list)
  - Write test for invalid message content type (not string)
  - Write test for instructions prepending with string input
  - Write test for instructions prepending with messages array input
  - Write test for text.format mapping to response_format.type
  - Write test for thread_id preservation as unknown field (PoC limitation)
  - Write test for max_output_tokens to max_tokens field rename
  - Verify all unit tests fail (no implementation exists yet)
  - _Requirements: 6.1, 6.5, 6.6_

- [ ] 4. Checkpoint - Verify all tests are failing
  - Ensure all property-based tests fail with "function not defined" or similar errors
  - Ensure all unit tests fail appropriately
  - Confirm test infrastructure is working correctly
  - Ask the user if questions arise about test coverage or approach

- [ ] 5. Implement core translation logic (TDD Green Phase)
  - [ ] 5.1 Create src/translation/response-to-chat/request.ts with translateResponseToChat function
    - Implement request validation (object type, required fields)
    - Implement model field extraction and validation
    - Implement input field extraction and validation (string or array)
    - Implement string input → messages array conversion (single user message)
    - Implement messages array input pass-through
    - Implement instructions prepending as system message
    - Implement standard parameter mapping (temperature, max_output_tokens→max_tokens, top_p, stream)
    - Implement tools and tool_choice pass-through
    - Implement text.format → response_format.type mapping
    - Implement metadata preservation
    - Implement unknown fields detection and preservation
    - Implement error handling with descriptive messages
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 5.2, 5.3_
  
  - [ ] 5.2 Create isResponseApiRequest validation function
    - Validate request is an object
    - Validate model field exists and is non-empty string
    - Validate input field exists and is string or array
    - Return boolean indicating validity
    - _Requirements: 5.1, 5.2_
  
  - [ ] 5.3 Create src/translation/response-to-chat/types.ts with type definitions
    - Define ResponseToChatTranslationResult interface
    - Define ResponseToChatTranslationOptions interface
    - Export types for use in other modules
    - _Requirements: 7.1, 7.3_
  
  - Run property-based tests and verify they pass
  - Run unit tests and verify they pass
  - _Requirements: 6.1, 6.2_

- [ ] 6. Implement translator adapter class (TDD Green Phase)
  - [ ] 6.1 Create src/translation/response-to-chat/request-translator.ts
    - Implement ResponseToChatRequestTranslator class
    - Implement RequestTranslator interface (translateRequest, isValidRequest methods)
    - Delegate translateRequest to translateResponseToChat function
    - Delegate isValidRequest to isResponseApiRequest function
    - Create factory function createResponseToChatRequestTranslator
    - _Requirements: 1.2, 7.1, 7.3, 7.4_
  
  - [ ]* 6.2 Write unit tests for translator adapter class
    - Test translateRequest delegates correctly
    - Test isValidRequest delegates correctly
    - Test factory function creates valid instance
    - Test interface compliance
    - _Requirements: 6.2_

- [ ] 7. Integrate with translation handler (TDD Green Phase)
  - [ ] 7.1 Add handleResponseToChatTranslation function to src/handlers/translation.handler.ts
    - Accept logger, requestId, request, and optional translator parameters
    - Use default ResponseToChatRequestTranslator if not provided
    - Delegate to orchestrateRequestTranslation utility
    - Return simplified TranslationHandlerResult for HTTP layer
    - Follow same pattern as handleChatToResponseTranslation
    - _Requirements: 1.4, 7.2, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 7.2 Write unit tests for handleResponseToChatTranslation
    - Test successful translation flow
    - Test translation error handling
    - Test default translator usage
    - Test custom translator injection
    - Test logging operations
    - _Requirements: 6.3, 8.1, 8.2, 8.3_

- [ ] 8. Integrate with routing handler (TDD Green Phase)
  - [ ] 8.1 Modify src/handlers/routing.handler.ts to support response→chat_completions translation
    - Add conditional branch for sourceFormat === 'response' && targetFormat === 'chat_completions'
    - Call handleResponseToChatTranslation in the new branch
    - Handle translation errors with 400 status code
    - Forward translated request to chatCompletionsHandler
    - Follow same pattern as existing chat→response branch
    - _Requirements: 7.6, 7.7_
  
  - [ ]* 8.2 Write unit tests for routing handler integration
    - Test response→chat_completions routing decision
    - Test translation invocation
    - Test error handling
    - Test pass-through to chatCompletionsHandler
    - _Requirements: 6.3_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Run all property-based tests (npm test)
  - Run all unit tests (npm run test:unit)
  - Verify 100% coverage for translation logic
  - Verify all 13 correctness properties pass
  - Ask the user if questions arise about implementation or test results

- [ ] 10. Write integration tests for end-to-end flows
  - [ ]* 10.1 Create tests/integration/regression/response-to-chat-translation.test.ts
    - Test complete Response API request → routing → translation → Chat Completions upstream flow
    - Test response translation back to Response API format
    - Test pass-through when source and target protocols match
    - Test error scenarios (validation errors, upstream errors)
    - Use testcontainers for Docker-based integration testing
    - _Requirements: 6.3_
  
  - [ ]* 10.2 Create smoke test for basic connectivity
    - Create tests/integration/smoke/response-to-chat-translation.test.ts
    - Test basic translation connectivity
    - Test health check endpoints still work
    - Test configuration loading
    - _Requirements: 6.3_
  
  - [ ]* 10.3 Write regression tests to ensure existing functionality still works
    - Test existing Chat→Response translation still works
    - Test routing handler doesn't break existing flows
    - Test pass-through handler still works for both endpoints
    - Verify no breaking changes to existing API
    - _Requirements: 6.3_

- [ ] 11. Refactor and optimize (TDD Refactor Phase)
  - Extract common validation patterns between Chat→Response and Response→Chat
  - Improve code readability and documentation
  - Ensure SOLID principles compliance (SRP, OCP, LSP, ISP, DIP)
  - Ensure Clean Architecture layer separation
  - Add JSDoc comments for all public functions and classes
  - Verify all tests still pass after refactoring
  - _Requirements: 7.3, 7.4_

- [ ] 12. Final checkpoint - Complete verification
  - Run full CI pipeline locally (npm run test:ci)
  - Verify linting passes (npm run lint)
  - Verify all unit tests pass (npm run test:unit)
  - Verify build succeeds (npm run build)
  - Verify Docker image builds successfully
  - Verify all integration tests pass (npm run test:integration)
  - Verify 100% test coverage for translation logic
  - Ensure all tests pass, ask the user if questions arise

## Git & Branching Standards

All implementation work SHALL follow the project's Git Branching & Commit Standards:

### Branch Creation
- Create feature branch: `git checkout -b feature/response-to-chat-translation`
- Branch naming: `feature/<short-description>` in kebab-case
- Branch from: `master` branch

### Commit Message Format
Follow conventional commit format for all commits:
```
<type>: <description>

[optional body]
```

**Commit Types**:
- `feat`: New feature implementation
- `test`: Adding or updating tests
- `refactor`: Code refactoring without behavior change
- `docs`: Documentation changes
- `chore`: Maintenance tasks (dependencies, config)

**Examples**:
```
feat(translation): implement response-to-chat request translation
test(translation): add property-based tests for round-trip translation
refactor(translation): extract common validation patterns
docs(translation): add JSDoc comments to translator adapter
```

### Workflow
1. Create feature branch from master
2. Implement tasks with regular commits
3. Run linter and tests before each commit
4. Push to remote: `git push -u origin feature/response-to-chat-translation`
5. Create pull request for review
6. Merge to master after approval

### Checkpoint Commits
After each checkpoint task, create a commit summarizing progress:
```
feat(translation): checkpoint - all property tests passing
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows with real Docker containers
- TDD methodology: Write failing tests FIRST (Red), implement to pass (Green), then refactor
- Follow existing patterns from Chat→Response translation for consistency
- PoC limitation: thread_id is preserved as unknown field but not processed for thread history retrieval
- All implementation work SHALL follow Git Branching & Commit Standards from project-standards.md
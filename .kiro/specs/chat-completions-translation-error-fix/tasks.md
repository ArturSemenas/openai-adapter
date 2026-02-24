# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Request Object Preservation During Translation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate headers become undefined when spread operator is used
  - **Scoped PBT Approach**: Scope the property to concrete failing case - chat completions request for model mapped to Response API (e.g., "gpt-4")
  - Test that routing handler preserves request.headers when translating chat completions to Response API format
  - Verify that request object passed to pass-through handler is a valid FastifyRequest instance with accessible headers property
  - Test implementation details from Fault Condition: isBugCondition returns true when routingDecision.decision === 'translate' AND sourceFormat === 'chat_completions' AND targetFormat === 'response'
  - The test assertions should verify: request.headers IS NOT undefined AND request IS FastifyRequest instance AND request.body === translationResult.translated
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with TypeError "Cannot convert undefined or null to object" (this is correct - it proves the bug exists)
  - Document counterexamples found: headers property becomes undefined, spread operator creates plain object losing Fastify properties
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Translation Request Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where isBugCondition returns false)
  - Observe: Pass-through requests (model mapped to chat_completions) work correctly with headers intact
  - Observe: Response API requests to `/v1/responses` endpoint process correctly according to model mapping
  - Observe: Validation errors (invalid JSON depth, missing model) return appropriate 400 responses
  - Observe: Translation logic itself (chat-to-response field mapping) produces correct output
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that pass-through requests continue to forward headers correctly for all non-translation scenarios
  - Test that response API requests continue to be processed correctly for all model mappings
  - Test that validation errors continue to return correct error responses for all invalid inputs
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for chat completions translation error

  - [x] 3.1 Implement the fix in routing.handler.ts
    - Remove object spread operator approach at lines 91-94 that creates plain object: `{...request, body: translationResult.translated}`
    - Directly modify request.body property instead: `request.body = translationResult.translated`
    - Pass original request object to pass-through handler (not a new plain object)
    - Preserve all Fastify request properties including headers, methods, and prototype chain
    - Maintain type safety - request object type remains FastifyRequest
    - Keep existing debug logging for translation completion
    - _Bug_Condition: isBugCondition(input) where input.routingDecision.decision === 'translate' AND sourceFormat === 'chat_completions' AND targetFormat === 'response' AND translationSucceeds(input.request.body)_
    - _Expected_Behavior: request.headers IS NOT undefined AND request IS FastifyRequest instance AND request.body === translationResult.translated (from design)_
    - _Preservation: Pass-through requests, response API requests, validation errors, and translation logic remain unchanged (from design)_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Request Object Preservation During Translation
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that request.headers is accessible and not undefined
    - Verify that request object is a valid FastifyRequest instance
    - Verify that request.body contains the translated payload
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Translation Request Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm pass-through requests still work correctly with headers intact
    - Confirm response API requests still process correctly
    - Confirm validation errors still return correct responses
    - Confirm translation logic still produces correct output
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

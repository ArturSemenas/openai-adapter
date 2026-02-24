---
inclusion: manual
---

# OpenAI Adapter - Complete Implementation Plan

## Overview

This document outlines the complete roadmap to build a fully functional bidirectional OpenAI protocol adapter. The adapter translates requests between Chat Completions API and Response API formats.

**Current Status**: 50% Complete (with critical bugfix applied)
- ✅ Chat→Response translation: Fully implemented
- ✅ Chat→Response bugfix: Fixed (spread operator → direct body modification)
- ❌ Response→Chat translation: Not implemented
- ❌ Response translation handlers: Not implemented
- ✅ Infrastructure: Complete (routing, validation, health checks)

**Target**: 100% Complete with full bidirectional translation and comprehensive testing

**Recent Fixes**:
- ✅ **Bugfix: Chat Completions Translation Error** (Spec: chat-completions-translation-error-fix)
  - Issue: TypeError "Cannot convert undefined or null to object" when translating chat completions to Response API
  - Root Cause: Spread operator created plain object, losing Fastify request properties (headers became undefined)
  - Fix: Direct body modification preserves FastifyRequest structure
  - Status: ✅ COMPLETE - All tests passing, no regressions, Docker deployment verified

---

## Phase 1: Complete Bidirectional Request Translation (Critical)

### Epic 1.1: Implement Response→Chat Request Translation

**Objective**: Enable requests arriving at `/v1/responses` to be translated to Chat Completions format when needed.

**Files to Create**:
```
src/translation/response-to-chat/
  ├── request.ts              # Core translation logic
  ├── request-translator.ts   # RequestTranslator interface wrapper
  ├── types.ts                # Type definitions
  └── index.ts                # Exports
```

**Tasks** (TDD - Write tests first):

1. **Create Response→Chat Request Translation Function**
   - File: `src/translation/response-to-chat/request.ts`
   - Function: `translateResponseToChat(request: unknown): TranslationResult`
   - Translate Response API request schema to Chat Completions schema
   - Handle field mapping (e.g., `input` → `messages`)
   - Preserve unknown fields for forward compatibility
   - Test cases:
     - Basic response request translation
     - Field mapping correctness
     - Unknown field preservation
     - Invalid request handling
     - Edge cases (empty arrays, null values, etc.)

2. **Create Response→Chat Request Validator**
   - Function: `isResponseApiRequest(request: unknown): boolean`
   - Validate request matches Response API schema
   - Test cases:
     - Valid response requests
     - Invalid response requests
     - Missing required fields
     - Type validation

3. **Create ResponseToChat RequestTranslator Wrapper**
   - File: `src/translation/response-to-chat/request-translator.ts`
   - Class: `ResponseToChatRequestTranslator implements RequestTranslator`
   - Wrap translation function in interface
   - Factory function: `createResponseToChatRequestTranslator()`
   - Test cases:
     - Interface implementation
     - Delegation to translation function
     - Error handling
     - Result format

4. **Create Type Definitions**
   - File: `src/translation/response-to-chat/types.ts`
   - Define `ResponseToChatTranslationResult`
   - Define `ResponseToChatTranslationOptions`
   - Align with existing Chat→Response types

5. **Update Module Exports**
   - File: `src/translation/index.ts`
   - Export new translator and factory function
   - Maintain backward compatibility

**Acceptance Criteria**:
- ✅ All tests pass (100% coverage for new code)
- ✅ TypeScript compilation succeeds
- ✅ No breaking changes to existing exports
- ✅ Unknown fields preserved
- ✅ Error handling consistent with Chat→Response direction

**Estimated Effort**: 2-3 hours

---

### Epic 1.2: Implement Response Translation Handlers

**Objective**: Handle translation of responses from upstream APIs back to client's original protocol format.

**Files to Create**:
```
src/handlers/
  ├── response-translation.handler.ts  # Response translation orchestration
  └── (update routing.handler.ts)
```

**Tasks** (TDD - Write tests first):

1. **Create Chat→Response Response Translation Function**
   - File: `src/translation/chat-to-response/response.ts`
   - Function: `translateChatToResponse(response: unknown): TranslationResult`
   - Translate Response API response back to Chat Completions format
   - Handle field mapping (e.g., `output` → `choices`)
   - Preserve unknown fields
   - Test cases:
     - Basic response translation
     - Field mapping correctness
     - Unknown field preservation
     - Error response handling
     - Edge cases

2. **Create Response→Chat Response Translation Function**
   - File: `src/translation/response-to-chat/response.ts`
   - Function: `translateResponseToChat(response: unknown): TranslationResult`
   - Translate Chat Completions response back to Response API format
   - Handle field mapping
   - Preserve unknown fields
   - Test cases:
     - Basic response translation
     - Field mapping correctness
     - Unknown field preservation
     - Error response handling
     - Edge cases

3. **Create Response Translation Handler**
   - File: `src/handlers/response-translation.handler.ts`
   - Function: `handleResponseTranslation(direction, response, options)`
   - Orchestrate response translation
   - Use translation orchestrator for logging
   - Test cases:
     - Chat→Response response translation
     - Response→Chat response translation
     - Error handling
     - Logging verification

4. **Update Routing Handler**
   - File: `src/handlers/routing.handler.ts`
   - After upstream response received, translate response back
   - Call response translation handler
   - Return translated response to client
   - Test cases:
     - Full bidirectional flow
     - Error scenarios
     - Pass-through scenarios

**Acceptance Criteria**:
- ✅ All tests pass (100% coverage for new code)
- ✅ Bidirectional response translation working
- ✅ Error responses handled correctly
- ✅ Unknown fields preserved
- ✅ Logging consistent with request translation

**Estimated Effort**: 2-3 hours

---

### Epic 1.3: Add Bidirectional E2E Tests

**Objective**: Verify complete request→response flows work correctly in both directions.

**Files to Create**:
```
tests/integration/translation/
  ├── bidirectional-flows.test.ts  # Complete bidirectional E2E tests
  └── response-translation.test.ts # Response translation tests
```

**Tasks**:

1. **Create Chat→Response→Chat E2E Test**
   - Send Chat Completions request to `/v1/chat/completions`
   - Verify request translated to Response API format
   - Verify upstream receives Response API format
   - Verify response translated back to Chat Completions format
   - Verify client receives Chat Completions response
   - Test cases:
     - Basic flow
     - With unknown fields
     - With error responses
     - With various model types

2. **Create Response→Chat→Response E2E Test**
   - Send Response API request to `/v1/responses`
   - Verify request translated to Chat Completions format
   - Verify upstream receives Chat Completions format
   - Verify response translated back to Response API format
   - Verify client receives Response API response
   - Test cases:
     - Basic flow
     - With unknown fields
     - With error responses
     - With various model types

3. **Create Pass-Through E2E Tests**
   - Send Chat request to Chat endpoint (no translation needed)
   - Send Response request to Response endpoint (no translation needed)
   - Verify requests forwarded as-is
   - Verify responses returned as-is

4. **Create Error Scenario Tests**
   - Invalid model (not in mapping)
   - Upstream timeout
   - Upstream error response
   - Malformed request
   - Connection limit exceeded

**Acceptance Criteria**:
- ✅ All bidirectional flows tested
- ✅ All error scenarios covered
- ✅ Pass-through scenarios verified
- ✅ Tests use real Docker containers for upstream mocks
- ✅ Tests are deterministic and repeatable

**Estimated Effort**: 2-3 hours

---

## Phase 2: Polish & Robustness (Important)

### Epic 2.1: Error Response Translation Strategy

**Objective**: Decide and implement how to handle error responses from upstream APIs.

**Decision Points**:
- Should error responses be translated to client's protocol?
- Or passed through as-is?
- How to handle protocol-specific error formats?

**Tasks**:

1. **Define Error Translation Strategy**
   - Document decision in architecture notes
   - Consider: error codes, error messages, error structure
   - Ensure consistency across both directions

2. **Implement Error Translation**
   - Add error translation to response handlers
   - Test error scenarios
   - Verify error messages are clear and actionable

3. **Add Error Scenario Tests**
   - Test upstream 400 errors
   - Test upstream 500 errors
   - Test upstream timeouts
   - Test malformed upstream responses

**Estimated Effort**: 1-2 hours

---

### Epic 2.2: Response Handling Improvements

**Objective**: Improve robustness of response handling.

**Tasks**:

1. **Add Response Validation**
   - Validate upstream responses match expected schema
   - Handle unexpected response formats
   - Add tests for edge cases

2. **Add Response Logging**
   - Log response translation operations
   - Log response sizes and latencies
   - Add tests for logging

3. **Handle Edge Cases**
   - Empty responses
   - Very large responses
   - Null/undefined fields
   - Unexpected field types

**Estimated Effort**: 1-2 hours

---

### Epic 2.3: Comprehensive Integration Testing

**Objective**: Ensure all scenarios work correctly together.

**Tasks**:

1. **Add Regression Tests**
   - Test that existing functionality still works
   - Test backward compatibility
   - Test configuration changes

2. **Add Concurrency Tests**
   - Test multiple simultaneous requests
   - Test connection limit enforcement
   - Test resource cleanup

3. **Add Timeout Tests**
   - Test upstream timeout handling
   - Test timeout configuration
   - Test timeout error responses

**Estimated Effort**: 1-2 hours

---

## Phase 3: Performance & Observability (Nice-to-Have)

### Epic 3.1: Add Metrics & Monitoring

**Objective**: Enable observability of adapter behavior.

**Tasks**:

1. **Add Prometheus Metrics**
   - Request count by endpoint
   - Request latency by endpoint
   - Translation latency
   - Upstream latency
   - Error count by type

2. **Add Structured Logging**
   - Log all translation operations
   - Log performance metrics
   - Log error details

3. **Add Health Metrics**
   - Track upstream API health
   - Track error rates
   - Track latency trends

**Estimated Effort**: 2-3 hours

---

### Epic 3.2: Performance Optimization

**Objective**: Optimize for high throughput and low latency.

**Tasks**:

1. **Response Streaming**
   - Stream large responses instead of buffering
   - Reduce memory usage
   - Improve latency for large payloads

2. **Connection Pooling**
   - Reuse connections to upstream API
   - Reduce connection overhead
   - Improve throughput

3. **Caching**
   - Cache model mappings
   - Cache translation schemas
   - Reduce CPU usage

**Estimated Effort**: 2-3 hours

---

## Phase 4: Future Enhancements (Out of PoC Scope)

### Epic 4.1: Additional Provider Support

**Objective**: Support additional LLM providers beyond OpenAI.

**Providers to Consider**:
- Anthropic Claude API
- Google Gemini API
- Cohere API
- Hugging Face Inference API

**Tasks**:
1. Design provider-agnostic translation layer
2. Implement provider-specific translators
3. Add provider selection to model mapping
4. Add comprehensive tests for each provider

**Estimated Effort**: 4-6 hours per provider

---

### Epic 4.2: Advanced Features

**Objective**: Add advanced features for production use.

**Features**:
- Request/response caching
- Rate limiting per API key
- Circuit breaker for upstream failures
- Request queuing for burst traffic
- Distributed tracing
- Request/response audit logging

**Estimated Effort**: 2-3 hours per feature

---

## Implementation Timeline

### Week 1: Phase 1 (Critical Path)
- **Days 1-2**: Epic 1.1 - Response→Chat request translation (6 hours)
- **Days 3-4**: Epic 1.2 - Response translation handlers (6 hours)
- **Days 5**: Epic 1.3 - Bidirectional E2E tests (6 hours)
- **Total**: ~18 hours

### Week 2: Phase 2 (Polish)
- **Days 1-2**: Epic 2.1 - Error response translation (4 hours)
- **Days 3-4**: Epic 2.2 - Response handling improvements (4 hours)
- **Days 5**: Epic 2.3 - Comprehensive integration testing (4 hours)
- **Total**: ~12 hours

### Week 3+: Phase 3 & 4 (Optional)
- Phase 3: Performance & observability (~8 hours)
- Phase 4: Future enhancements (as needed)

---

## Success Criteria

### Phase 1 Completion (Critical)
- ✅ Response→Chat request translation implemented
- ✅ Response translation handlers implemented
- ✅ Bidirectional E2E tests passing
- ✅ All tests passing (315+ tests)
- ✅ 100% coverage for new code
- ✅ Zero regression in existing functionality
- ✅ Full bidirectional translation working

### Phase 2 Completion (Important)
- ✅ Error responses handled correctly
- ✅ Response handling robust and tested
- ✅ Comprehensive integration tests passing
- ✅ All edge cases covered

### Phase 3 Completion (Nice-to-Have)
- ✅ Metrics and monitoring in place
- ✅ Performance optimized
- ✅ Production-ready

---

## Testing Strategy

### TDD Workflow (Mandatory for All Phases)

**For each task**:
1. Write failing tests first (RED)
2. Implement minimum code to pass (GREEN)
3. Refactor and improve (REFACTOR)
4. Repeat for next feature

### Test Coverage Targets

- **Translation logic**: 100% coverage
- **Response handlers**: 100% coverage
- **Routing logic**: 100% coverage
- **Overall**: 90%+ coverage

### Test Execution

```bash
# During development (watch mode)
npm run test:watch

# Before committing
npm run test:unit
npm run test:integration:local

# Full CI pipeline
npm run test:ci
```

---

## Code Quality Standards

### SOLID Principles
- ✅ Single Responsibility: Each module has one reason to change
- ✅ Open/Closed: Open for extension, closed for modification
- ✅ Liskov Substitution: Subtypes substitutable for base types
- ✅ Interface Segregation: No client depends on unused methods
- ✅ Dependency Inversion: Depend on abstractions, not concretions

### Clean Architecture
- ✅ Entities: Core business logic (translation types)
- ✅ Use Cases: Application logic (translation operations)
- ✅ Interface Adapters: HTTP handlers, configuration loaders
- ✅ Frameworks & Drivers: Fastify, Pino, external libraries

### Code Style
- ✅ TypeScript strict mode
- ✅ ESLint compliance
- ✅ Prettier formatting
- ✅ Comprehensive JSDoc comments
- ✅ Descriptive variable/function names

---

## Risk Mitigation

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Response translation complexity | Start with simple cases, add complexity incrementally |
| Breaking existing functionality | Comprehensive regression tests, zero-breaking-change policy |
| Performance degradation | Performance tests, profiling, optimization as needed |
| Incomplete error handling | Comprehensive error scenario tests |
| Unclear requirements | Document decisions in architecture notes |

---

## Rollout Strategy

### Phase 1 Rollout (Critical)
1. Implement Response→Chat translation
2. Add comprehensive tests
3. Deploy to staging
4. Verify bidirectional flows
5. Deploy to production

### Phase 2 Rollout (Important)
1. Implement error handling improvements
2. Add edge case tests
3. Deploy to staging
4. Verify robustness
5. Deploy to production

### Phase 3 Rollout (Optional)
1. Add metrics and monitoring
2. Performance optimization
3. Deploy to staging
4. Monitor performance
5. Deploy to production

---

## Documentation Updates

### Required Documentation
- [ ] Update README.md with bidirectional flow examples
- [ ] Add architecture decision records (ADRs) for key decisions
- [ ] Document error handling strategy
- [ ] Add troubleshooting guide
- [ ] Update API documentation with examples

### Code Documentation
- [ ] JSDoc comments for all new functions
- [ ] Inline comments for complex logic
- [ ] Type definitions with descriptions
- [ ] Example usage in comments

---

## Monitoring & Maintenance

### Post-Launch Monitoring
- Monitor error rates and types
- Track latency metrics
- Monitor resource usage
- Track upstream API health

### Maintenance Tasks
- Regular dependency updates
- Security vulnerability scanning
- Performance optimization
- Bug fixes and improvements

---

## Next Steps

1. **Start Phase 1, Epic 1.1**
   - Create `src/translation/response-to-chat/request.ts`
   - Write failing tests first
   - Implement translation logic
   - Verify tests pass

2. **Create spec task for Phase 1**
   - Document tasks in `.kiro/specs/`
   - Set up task tracking
   - Assign effort estimates

3. **Set up development workflow**
   - Use `npm run test:watch` for TDD
   - Run `npm run test:ci` before commits
   - Keep tests passing at all times

---

## References

- Architecture: `.kiro/steering/architecture.md`
- Project Standards: `.kiro/steering/project-standards.md`
- Testing Guide: `.kiro/steering/testing-guide.md`
- Current Spec: `.kiro/specs/architecture-alignment/tasks.md`

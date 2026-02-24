---
inclusion: always
---

# OpenAI Adapter - Project Standards

## Project Overview

This is a proof-of-concept (PoC) bidirectional protocol adapter that unifies and translates requests between two OpenAI API protocols:
- **OpenAI Chat Completions API** - Standard chat-based completions
- **OpenAI Response API** - Assistants/Threads-based responses

The service provides **full bidirectional functionality**:
- Translate incoming Chat Completion requests → Response API calls
- Translate incoming Response API requests → Chat Completion calls
- Map responses back to the caller's expected protocol format

**Core Design Principles**:
- **Bidirectional Protocol Adaptation**: Symmetric mapping for request/response schemas between OpenAI protocols
- **Clean Architecture**: Strategy/Adapter pattern design to maintain separation between routing and translation logic
- **Minimalism**: Focus strictly on functional routing and adaptation between OpenAI APIs; exclude advanced optimizations, additional providers, security layers, or complex logging in this PoC phase

## Technical Constraints (Non-Negotiable)

### Architecture
- **Clean Architecture**: Strict adherence to Clean Architecture principles
  - **Entities**: Core business logic and domain models (translation types, request/response models)
  - **Use Cases**: Application-specific business rules (translation operations, routing decisions)
  - **Interface Adapters**: Controllers, presenters, and gateways (handlers, HTTP adapters)
  - **Frameworks & Drivers**: External tools and frameworks (Fastify, Pino)
- **Dependency Rule**: Dependencies must point inward only (outer layers depend on inner layers, never the reverse)
- **Layer Isolation**: Each layer must be independently testable

### Methodology
- **Test-Driven Development (TDD)**: Mandatory for all new features
  - Write failing tests FIRST before any implementation
  - Red → Green → Refactor cycle
  - Both directions of translation must have failing tests before implementation
  - No production code without corresponding tests

### SOLID Principles
- **Single Responsibility Principle (SRP)**: Each class/module has one reason to change
  - Translation functions handle only translation logic
  - Routing handles only routing decisions
  - Handlers handle only HTTP request/response orchestration
- **Open/Closed Principle**: Open for extension, closed for modification
- **Liskov Substitution Principle**: Subtypes must be substitutable for base types
- **Interface Segregation Principle (ISP)**: No client should depend on methods it doesn't use
  - Separate interfaces for request translation vs response translation
  - Separate interfaces for each translation direction
- **Dependency Inversion Principle**: Depend on abstractions, not concretions

### Testing Suite Requirements

#### Unit Tests (Mandatory)
- **Bidirectional transformation logic**: Test both A→B and B→A translations
- **Isolated testing**: Mock all external dependencies
- **Coverage targets**: 
  - Translation logic: 100% coverage
  - Routing logic: 100% coverage
  - Validation logic: 100% coverage
- **Test structure**: Arrange-Act-Assert pattern
- **Test naming**: Descriptive names explaining what is tested and expected outcome

#### Smoke Tests (Mandatory)
- **Connectivity verification**: Test connection to mock provider endpoints
- **Basic functionality**: Verify service starts and responds
- **Health checks**: Verify /health and /ready endpoints
- **Configuration loading**: Verify configuration loads correctly

#### End-to-End (E2E) Tests (Mandatory)
- **Agent-to-router flows**: Simulate complete request/response cycles
- **Both protocol types**: Test Chat Completions and Response API flows
- **Bidirectional scenarios**:
  - Chat Completions request → Response API upstream → Chat Completions response
  - Response API request → Chat Completions upstream → Response API response
- **Pass-through scenarios**: Test when source and target protocols match
- **Error scenarios**: Test validation errors, upstream errors, timeouts

## Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.5.4 with strict mode
- **Framework**: Fastify 4.x
- **Testing**: Vitest
- **Logging**: Pino
- **Module System**: ES Modules (type: "module")

## Code Style & Standards

### TypeScript Configuration

- Use strict mode (all strict checks enabled)
- Target ES2022
- Use NodeNext module resolution
- Always use `.js` extensions in imports (required for ES modules)
- Prefer explicit types over `any`
- Use type imports with `type` keyword when importing only types

### Naming Conventions

- **Files**: kebab-case (e.g., `routing.handler.ts`, `error-formatter.ts`)
- **Types/Interfaces**: PascalCase (e.g., `AdapterConfig`, `ApiType`)
- **Functions/Variables**: camelCase (e.g., `loadConfiguration`, `activeConnections`)
- **Constants**: SCREAMING_SNAKE_CASE for error types (e.g., `VALIDATION_ERROR_TYPES`)

### Code Organization

- Keep source code in `src/` directory
- Group related functionality in subdirectories (e.g., `config/`, `handlers/`, `validation/`)
- Co-locate unit tests with source files using `.test.ts` suffix when appropriate
- Place integration tests in `tests/integration/`
- Export types from dedicated `types.ts` files

### Error Handling

- Use custom error classes that extend `Error`
- Provide clear, actionable error messages
- Include request IDs in error responses for traceability
- Use Fastify's error handler for centralized error processing
- Validate configuration at startup and fail fast with clear messages

## Testing Standards

### Test Organization

- **Unit tests**: `tests/unit/` - test individual functions/modules in isolation
- **Integration tests**: `tests/integration/` - test full request/response flows
- **Smoke tests**: `tests/integration/smoke/` - basic health checks
- **Regression tests**: `tests/integration/regression/` - prevent known bugs from reoccurring

### Test Commands

- `npm test` - run all unit tests
- `npm run test:unit` - run unit tests only
- `npm run test:integration` - run smoke + regression tests
- `npm run test:smoke` - run smoke tests only
- `npm run test:regression` - run regression tests only
- `npm run test:ci` - full CI pipeline (lint, unit, build, docker, integration)

### Testing Best Practices

- Write tests that can run immediately without manual setup
- Use descriptive test names that explain what is being tested
- Test both success and error cases
- Mock external dependencies (HTTP calls, file system) in unit tests
- Use real Docker containers for integration tests (testcontainers)
- Keep tests fast and focused

## Configuration Management

### Environment Variables

**Required:**
- `ADAPTER_TARGET_URL` - target OpenAI API base URL
- `MODEL_API_MAPPING_FILE` - path to model-to-API mapping JSON

**Optional:**
- `PORT` (default: 3000)
- `LOG_PRETTY` (set to "1" for pretty logs)
- `UPSTREAM_TIMEOUT_SECONDS` (default: 60, must be positive integer)
- `MAX_CONCURRENT_CONNECTIONS` (default: 1000, must be positive integer)

### Configuration Validation

- Validate all configuration at startup
- Fail fast with clear error messages if configuration is invalid
- Use `env-schema` for environment variable validation
- Validate JSON files for correct structure and required fields

## API Design

### Endpoints

- `/health` - Liveness probe (always returns 200 if process alive)
- `/ready` - Readiness probe (returns 200 if ready, 503 if not)
- `/v1/responses` - Accepts Response API requests, may translate to Chat Completions based on model mapping
- `/v1/chat/completions` - Accepts Chat Completions requests, may translate to Response API based on model mapping

**Bidirectional Translation**:
- Requests arriving at either endpoint can be translated to the other protocol
- Model mapping configuration determines which protocol to use upstream
- Responses are translated back to match the caller's original protocol format

### Health & Readiness

- Health and readiness endpoints bypass connection limits
- These endpoints do not log requests (avoid log clutter)
- Readiness checks configuration validity only (no external dependencies in MVP)

### Request/Response Handling

- Use Fastify's built-in request ID for traceability
- Include request IDs in all error responses
- Enforce connection limits (503 when exceeded)
- Enforce request size limits (400 when exceeded)
- Validate JSON depth to prevent DoS attacks

## Logging

- Use Pino for structured JSON logging
- Log at appropriate levels (info, warn, error)
- Include context in log messages (action, requestId, etc.)
- Silence health/readiness endpoint logs to avoid clutter
- Use pretty logging in development (`LOG_PRETTY=1`)

## Docker & Deployment

- Use multi-stage Docker builds for minimal image size
- Run as non-root user in containers
- Expose port 3000 by default
- Support health checks via `/health` endpoint
- Build and test Docker images in CI pipeline

## Git Branching & Commit Standards

### Branch Naming Conventions

For each new feature or bugfix, create a separate branch following these conventions:

- **Feature branches**: `feature/<short-description>` (e.g., `feature/response-to-chat-translation`)
- **Bugfix branches**: `bugfix/<issue-description>` (e.g., `bugfix/null-pointer-fix`)
- **Hotfix branches**: `hotfix/<issue-description>` (e.g., `hotfix/memory-leak`)

**Rules**:
- Use kebab-case (lowercase with hyphens)
- No spaces or uppercase letters
- Keep descriptions concise and descriptive

### Commit Message Format

Follow conventional commit format for clear, searchable history:

```
<type>: <description>

[optional body]
```

**Commit Types**:
- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding or updating tests
- `refactor`: Code refactoring without behavior change
- `docs`: Documentation changes
- `chore`: Maintenance tasks (dependencies, config)
- `ci`: CI/CD pipeline changes

**Examples**:
```
feat(translation): add response-to-chat request translation
fix(validation): handle null values in JSON depth validator
test(handlers): add unit tests for routing handler
refactor(config): extract validation to separate module
docs(readme): update installation instructions
```

**Rules**:
- First line max 72 characters
- Use imperative mood ("add" not "added")
- Scope is optional but recommended (e.g., `feat(translation):`)

## Development Workflow

1. Create feature/bugfix branch from main: `git checkout -b feature/my-feature`
2. Make changes to source code
3. Run linter: `npm run lint`
4. Run unit tests: `npm run test:unit`
5. Build TypeScript: `npm run build`
6. Run integration tests: `npm run test:integration:local`
7. Commit with conventional format: `git commit -m "feat: add new feature"`
8. Run full CI locally: `npm run test:ci`
9. Push and create pull request

## Performance Considerations

- Use connection pooling for upstream requests
- Enforce concurrent connection limits to prevent resource exhaustion
- Set reasonable timeouts for upstream requests
- Validate request size and JSON depth to prevent DoS
- Use streaming where appropriate for large responses

## Security Best Practices

- Validate all inputs (environment variables, JSON payloads, headers)
- Sanitize error messages (don't leak sensitive information)
- Use strict TypeScript to catch type errors at compile time
- Keep dependencies up to date
- Run as non-root user in Docker containers
- Enforce request size limits
- Validate JSON depth to prevent stack overflow attacks

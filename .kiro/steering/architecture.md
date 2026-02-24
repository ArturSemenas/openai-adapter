---
inclusion: always
---

# Architecture Overview

## System Architecture

The OpenAI Adapter is a stateless bidirectional protocol translation service that converts requests between two OpenAI API formats based on model-to-API mappings.

```
Client Request (Protocol A) → Adapter → Model Mapping → Translate to Protocol B → Upstream API
                                 ↓                              ↓
                          Validation & Limits            Response Translation
                                                                 ↓
Client Response (Protocol A) ← Translate Back ← Upstream Response (Protocol B)
```

**Key Concept**: The adapter provides symmetric bidirectional translation:
- Chat Completions → Response API (and response back)
- Response API → Chat Completions (and response back)

### Protocol State Management

**Critical Architectural Consideration**: The two OpenAI APIs have fundamentally different state management models:

**Chat Completions API (Stateless)**:
- Each request is independent and self-contained
- Full conversation history must be included in every request via `messages[]` array
- No server-side state is maintained between requests
- Client is responsible for managing conversation context

**Response API (Stateful)**:
- Maintains conversation state server-side via `thread_id`
- Each request references a thread that persists conversation history
- Server manages message history and context
- Client only needs to send new messages, not full history

**Adapter State Management**:
- The adapter itself is stateless (no conversation state stored in adapter)
- When translating Chat → Response: Adapter passes through to stateful upstream (thread state managed by upstream Response API)
- When translating Response → Chat: Adapter must retrieve full thread history from upstream to construct stateless Chat Completions request
- The adapter acts as a protocol translator only; state management responsibility remains with the upstream API or client depending on protocol direction

## Core Components

### 1. Configuration Layer (`src/config/`)

**Purpose**: Load, validate, and manage application configuration

**Key Files**:
- `loader.ts` - Loads configuration from environment and files
- `validator.ts` - Validates configuration structure and values
- `state.ts` - Manages global configuration state for readiness checks
- `types.ts` - Configuration type definitions

**Responsibilities**:
- Load environment variables
- Load and parse model mapping JSON file
- Validate all configuration at startup
- Provide configuration to other components
- Track configuration validity for readiness probe

### 2. Handlers Layer (`src/handlers/`)

**Purpose**: Process HTTP requests and generate responses

**Key Files**:
- `health.ts` - Health and readiness probe handlers
- `routing.handler.ts` - Routes requests based on model mapping
- `translation.handler.ts` - Translates between API formats
- `pass-through.handler.ts` - Passes requests through without translation
- `error-formatter.ts` - Formats validation errors consistently

**Responsibilities**:
- Handle health/readiness checks
- Route requests to appropriate handlers
- Translate request/response formats
- Format error responses
- Enforce request limits

### 3. Routing Layer (`src/routing/`)

**Purpose**: Determine which API type to use based on model and orchestrate translation

**Responsibilities**:
- Look up model in mapping configuration
- Determine target API type (response vs chat_completions)
- Route to appropriate handler (translation or pass-through)
- Coordinate bidirectional translation flow

### 4. Translation Layer (`src/translation/`)

**Purpose**: Provide bidirectional conversion between OpenAI API formats

**Key Files**:
- `chat-to-response/request.ts` - Translates chat completions requests to response format
- `chat-to-response/response.ts` - Translates response API responses back to chat format
- `response-to-chat/request.ts` - Translates response API requests to chat format
- `response-to-chat/response.ts` - Translates chat completions responses back to response format
- `utils/translation-logger.ts` - Logs translation operations
- `utils/unknown-fields.ts` - Handles unknown fields in requests

**Responsibilities**:
- Transform request payloads bidirectionally between API formats
- Transform response payloads bidirectionally between API formats
- Preserve unknown fields for forward compatibility
- Maintain semantic equivalence across translations
- Log translation operations for debugging

**Design Pattern**: Strategy/Adapter pattern to maintain clean separation between translation logic and routing

### 5. Validation Layer (`src/validation/`)

**Purpose**: Validate requests to prevent abuse and errors

**Key Files**:
- `payload-size-validator.ts` - Enforces maximum request size
- `json-depth-validator.ts` - Prevents deeply nested JSON attacks

**Responsibilities**:
- Validate request size limits
- Validate JSON depth limits
- Throw validation errors with clear messages

## Request Flow

### Standard Request Flow (Bidirectional Translation)

**Example: Chat Completions → Response API (Stateless → Stateful)**

1. **Request arrives** at `/v1/chat/completions` endpoint
2. **Connection limit check** - Reject if over limit (503)
3. **Routing handler** - Look up model, determine target is `response` API
4. **Request translation** - Convert Chat Completions format → Response API format
   - Extract messages from stateless request
   - Create or reference thread_id for stateful upstream
   - Map message roles and content
5. **Validation** - Check size and depth limits
6. **Upstream request** - Forward translated request to Response API endpoint (state managed by upstream)
7. **Response translation** - Convert Response API response → Chat Completions format
8. **Return response** to client in original Chat Completions format

**Example: Response API → Chat Completions (Stateful → Stateless)**

1. **Request arrives** at `/v1/responses` endpoint
2. **Connection limit check** - Reject if over limit (503)
3. **Routing handler** - Look up model, determine target is `chat_completions` API
4. **Request translation** - Convert Response API format → Chat Completions format
   - Retrieve full thread history from upstream (if thread_id provided)
   - Construct complete messages[] array from thread history
   - Map message roles and content
5. **Validation** - Check size and depth limits
6. **Upstream request** - Forward translated request to Chat Completions endpoint (stateless)
7. **Response translation** - Convert Chat Completions response → Response API format
8. **Return response** to client in original Response API format

**Pass-through Flow** (when source and target protocols match):

1. **Request arrives** at endpoint
2. **Routing handler** - Determine no translation needed
3. **Validation** - Check size and depth limits
4. **Upstream request** - Forward request as-is
5. **Return response** to client as-is

### Health Check Flow

1. **Request arrives** at `/health`
2. **Bypass connection limit** - Always allowed
3. **Return 200** - Process is alive

### Readiness Check Flow

1. **Request arrives** at `/ready`
2. **Bypass connection limit** - Always allowed
3. **Check config state** - Valid or invalid?
4. **Return 200 or 503** - Ready or not ready

## Error Handling Strategy

### Validation Errors (400)

- Invalid request payload
- Request too large
- JSON too deeply nested
- Missing required fields

### Server Errors (503)

- Connection limit exceeded
- Configuration invalid (readiness check)

### Upstream Errors (pass-through)

- Forward upstream API errors to client
- Preserve status codes and error messages

## Configuration Management

### Startup Configuration

1. Load environment variables
2. Load model mapping file
3. Validate all configuration
4. Set global config state (valid/invalid)
5. Start server or exit with error

### Runtime Configuration

- Configuration is immutable after startup
- No hot-reloading in MVP scope
- Restart required for configuration changes

## Concurrency & Resource Management

### Connection Limiting

- Track active connections globally
- Enforce `MAX_CONCURRENT_CONNECTIONS` limit
- Return 503 when limit exceeded
- Health/readiness endpoints bypass limit

### Timeout Management

- Set upstream request timeout via `UPSTREAM_TIMEOUT_SECONDS`
- Default 60 seconds
- Configurable per deployment

### Memory Management

- Enforce request size limits via `maxRequestSizeBytes`
- Enforce JSON depth limits via `maxJsonDepth`
- Use streaming for large responses (future)

## Logging Strategy

### Structured Logging

- Use Pino for JSON structured logs
- Include context in all log messages
- Use appropriate log levels (info, warn, error)

### Log Levels

- **info**: Normal operations (startup, config loaded, requests)
- **warn**: Unusual but handled situations
- **error**: Errors that require attention

### Log Suppression

- Health/readiness endpoints don't log requests
- Prevents log clutter from frequent health checks

## Deployment Architecture

### Container Orchestration

- Designed for Kubernetes/Docker Swarm
- Liveness probe: `/health`
- Readiness probe: `/ready`
- Graceful shutdown support

### Horizontal Scaling

- Adapter is stateless (no conversation state stored in adapter instances)
- Conversation state is managed by upstream APIs (Response API threads) or clients (Chat Completions message history)
- Multiple adapter instances can run in parallel
- Load balancer distributes requests across instances
- No session affinity required at adapter level

### Configuration Management

- Environment variables for runtime config
- ConfigMaps/Secrets for sensitive data
- Model mapping file mounted as volume

## Clean Architecture Layers

### Layer 1: Entities (Core Domain)
**Location**: `src/translation/types.ts`, `src/config/types.ts`

**Purpose**: Core business logic and domain models

**Components**:
- Translation types and interfaces
- Request/response models
- Configuration types
- Domain validation rules

**Rules**:
- No dependencies on outer layers
- Pure business logic only
- Framework-agnostic
- Highly stable (rarely changes)

### Layer 2: Use Cases (Application Business Rules)
**Location**: `src/translation/`, `src/routing/`

**Purpose**: Application-specific business rules

**Components**:
- Translation operations (chat-to-response, response-to-chat)
- Routing decisions (model mapping, format detection)
- Validation logic (JSON depth, payload size)

**Rules**:
- Depends only on Entities layer
- Orchestrates domain objects
- Contains application-specific logic
- Independent of UI, database, frameworks

### Layer 3: Interface Adapters
**Location**: `src/handlers/`, `src/config/loader.ts`

**Purpose**: Convert data between use cases and external systems

**Components**:
- HTTP handlers (routing, translation, pass-through)
- Configuration loaders
- Error formatters
- Logging adapters

**Rules**:
- Depends on Use Cases and Entities
- Converts external formats to internal formats
- Handles HTTP-specific concerns
- Adapts between frameworks and use cases

### Layer 4: Frameworks & Drivers
**Location**: `src/index.ts`, external libraries

**Purpose**: External tools and frameworks

**Components**:
- Fastify server setup
- Pino logging
- Environment variable loading
- HTTP client (fetch)

**Rules**:
- Outermost layer
- Contains framework-specific code
- Minimal business logic
- Easily replaceable

## Design Patterns

### Strategy/Adapter Pattern

The translation layer uses Strategy/Adapter patterns to maintain clean separation:

```typescript
// Interface Segregation: Separate interfaces for each concern
interface RequestTranslator {
  translateRequest(request: unknown): TranslationResult;
}

interface ResponseTranslator {
  translateResponse(response: unknown): TranslationResult;
}

// PoC Scope: OpenAI Chat ↔ OpenAI Response only
```

**Benefits**:
- Separate translation logic from routing logic (SRP)
- Test translations independently
- Maintain separation of concerns
- Clear interfaces between components (ISP)
- Easy to extend with new translation strategies (OCP)

**SOLID Compliance**:
- **SRP**: Each translator handles one direction only
- **OCP**: New translators can be added without modifying existing code
- **LSP**: All translators implement the same interface contract
- **ISP**: Separate interfaces for request vs response translation
- **DIP**: Handlers depend on translator interfaces, not concrete implementations

**PoC Scope**: Only OpenAI Chat Completions ↔ OpenAI Response API translation is implemented. Additional providers (Anthropic, Gemini, etc.) are out of scope for this phase.

## Future Considerations

### Potential Future Enhancements (Out of PoC Scope)

**State Management Layer (Future)**:
- Adapter-side conversation state storage (Redis/database)
- Request deduplication via request ID tracking
- Conversation ID mapping and persistence
- State synchronization across adapter instances
- Session affinity or distributed state management
- State cleanup and expiration policies

**Other Future Enhancements**:
- Response streaming for large payloads
- Caching layer for repeated requests
- Metrics and observability (Prometheus)
- Rate limiting per client/API key
- Request/response logging for audit
- Additional provider support (Anthropic, Gemini, etc.)
- Redis for distributed rate limiting
- Connection pooling for upstream requests
- Circuit breaker for upstream failures
- Request queuing for burst traffic

**PoC Scope**: Focus strictly on functional bidirectional translation between OpenAI Chat Completions and OpenAI Response API with stateless adapter design. The adapter delegates state management to upstream OpenAI APIs (Response API threads) or clients (Chat Completions message history). Performance optimizations, adapter-side state storage, additional providers, advanced security, and complex logging are explicitly out of scope.

**Design for Future State Management**:
The current stateless architecture can be extended with a state management layer without breaking existing functionality:
1. Add optional state storage interface (Strategy pattern)
2. Implement state storage adapters (Redis, database, in-memory)
3. Add configuration flag to enable/disable state management
4. Maintain backward compatibility with stateless mode

# Requirements Document

## Introduction

This document specifies the requirements for implementing Response API to Chat Completions request translation in the OpenAI Adapter. This feature completes the bidirectional request translation capability by adding the reverse direction to the existing Chat→Response translation.

The Response→Chat request translator will convert incoming Response API format requests into Chat Completions format for upstream processing, enabling clients using the Response API protocol to communicate with Chat Completions endpoints through the adapter.

## Glossary

- **Response_API**: OpenAI's Assistants/Threads-based API format for structured conversations
- **Chat_Completions_API**: OpenAI's standard chat-based completions API format
- **Request_Translator**: Interface for translating request payloads between API formats
- **Translation_Orchestrator**: Utility that coordinates translation operations with logging
- **Unknown_Fields**: Request fields not explicitly mapped that must be preserved for forward compatibility
- **Semantic_Equivalence**: Property where translated requests produce functionally equivalent results
- **Adapter**: The OpenAI protocol translation service
- **Upstream_API**: The target OpenAI API that receives translated requests

## Requirements

### Requirement 1: Translate Response API Requests to Chat Completions Format

**User Story:** As a client using Response API format, I want my requests translated to Chat Completions format, so that I can communicate with Chat Completions endpoints through the adapter.

#### Acceptance Criteria

1. WHEN a Response API request is provided, THE Request_Translator SHALL convert it to Chat Completions format
2. THE Request_Translator SHALL implement the RequestTranslator interface defined in the architecture
3. THE Request_Translator SHALL preserve all semantically equivalent fields during translation
4. THE Request_Translator SHALL use the Translation_Orchestrator for coordinated translation operations
5. FOR ALL valid Response API requests, translating to Chat Completions then back to Response API SHALL produce semantically equivalent requests (round-trip property)

### Requirement 2: Map Core Request Fields

**User Story:** As a developer, I want core request fields mapped correctly between formats, so that translated requests maintain their intended behavior.

#### Acceptance Criteria

1. WHEN a Response API request contains a model field, THE Request_Translator SHALL map it to the Chat Completions model field
2. WHEN a Response API request contains an input field (string or messages array), THE Request_Translator SHALL map it to Chat Completions messages array
   - IF input is a string, THEN convert it to a single-message array with role "user"
   - IF input is a messages array, THEN pass it through directly (both formats use the same message structure with role and content fields)
   - Note: Response API and Chat Completions use identical message array formats per OpenAI documentation
3. WHEN a Response API request contains an instructions field, THE Request_Translator SHALL prepend it as a system message in the Chat Completions messages array
4. WHEN a Response API request contains temperature, THE Request_Translator SHALL map it to Chat Completions temperature
5. WHEN a Response API request contains max_output_tokens, THE Request_Translator SHALL map it to Chat Completions max_tokens
6. WHEN a Response API request contains top_p, THE Request_Translator SHALL map it to Chat Completions top_p
7. WHEN a Response API request contains stream, THE Request_Translator SHALL map it to Chat Completions stream
8. FOR ALL mapped fields, the translated values SHALL maintain semantic equivalence with the original values

### Requirement 3: Handle Optional and Format-Specific Fields

**User Story:** As a developer, I want format-specific fields handled appropriately, so that translation preserves all relevant information.

#### Acceptance Criteria

1. WHEN a Response API request contains tools, THE Request_Translator SHALL map them to Chat Completions tools format (both formats use identical tool structure)
2. WHEN a Response API request contains tool_choice, THE Request_Translator SHALL map it to Chat Completions tool_choice (both formats use identical tool_choice structure)
3. WHEN a Response API request contains text.format field, THE Request_Translator SHALL map it to Chat Completions response_format.type
4. WHEN a Response API request contains a metadata field (key-value pairs for custom data), THE Request_Translator SHALL preserve it as metadata in Chat Completions format
   - Note: metadata is a standard field in both APIs for storing custom key-value pairs, not an unknown field
5. WHEN optional fields are absent, THE Request_Translator SHALL omit them from the translated request

### Requirement 4: Preserve Unknown Fields for Forward Compatibility

**User Story:** As a system maintainer, I want unknown fields preserved during translation, so that the adapter remains compatible with future API versions.

#### Acceptance Criteria

1. WHEN a Response API request contains fields not in the known mapping, THE Request_Translator SHALL preserve them using the unknown-fields utility
2. THE Request_Translator SHALL attach preserved Unknown_Fields to the translated request
3. WHEN translating back (Chat→Response), THE Unknown_Fields SHALL be restored to their original positions
4. THE Request_Translator SHALL log preserved Unknown_Fields for debugging purposes

### Requirement 5: Validate Translated Requests

**User Story:** As a developer, I want translated requests validated, so that invalid translations are caught before reaching upstream APIs.

#### Acceptance Criteria

1. WHEN translation produces a request, THE Request_Translator SHALL validate it conforms to Chat Completions schema
2. IF required fields are missing after translation, THEN THE Request_Translator SHALL return a validation error
3. IF field types are incorrect after translation, THEN THE Request_Translator SHALL return a validation error
4. THE Request_Translator SHALL validate payload size limits using the payload-size-validator
5. THE Request_Translator SHALL validate JSON depth limits using the json-depth-validator

### Requirement 6: Implement Test-Driven Development

**User Story:** As a developer, I want comprehensive tests written before implementation, so that the translation logic is verified to work correctly.

#### Acceptance Criteria

1. THE development process SHALL follow TDD methodology with failing tests written before implementation
2. THE test suite SHALL include unit tests for the Request_Translator with 100% coverage
3. THE test suite SHALL include integration tests for complete request translation flows
4. THE test suite SHALL include round-trip property tests verifying semantic equivalence
5. THE test suite SHALL include edge case tests for missing fields, null values, and empty arrays
6. THE test suite SHALL include error case tests for invalid inputs and validation failures

### Requirement 7: Integrate with Existing Architecture

**User Story:** As a system architect, I want the translator integrated with existing patterns, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. THE Request_Translator SHALL be located in src/translation/response-to-chat/request.ts following existing structure
2. THE Request_Translator SHALL use the Translation_Orchestrator for logging translation operations
3. THE Request_Translator SHALL follow Clean Architecture principles with proper layer separation
4. THE Request_Translator SHALL comply with SOLID principles (SRP, OCP, LSP, ISP, DIP)
5. THE Request_Translator SHALL use the same error handling patterns as the Chat→Response translator
6. THE Request_Translator SHALL be invoked by the routing handler when Response→Chat translation is needed
   - Note: The routing handler (src/handlers/routing.handler.ts) already detects translation direction based on sourceFormat and targetFormat
   - The handler currently returns 501 "Not Implemented" for response_to_chat_completions direction
   - Integration requires adding a new conditional branch in routing.handler.ts to call handleResponseToChatTranslation (similar to existing handleChatToResponseTranslation)
7. THE routing handler SHALL be modified to support the response→chat_completions translation direction without breaking existing functionality

### Requirement 8: Log Translation Operations

**User Story:** As a system operator, I want translation operations logged, so that I can debug issues and monitor adapter behavior.

#### Acceptance Criteria

1. WHEN translation begins, THE Request_Translator SHALL log the operation start with request context
2. WHEN translation completes successfully, THE Request_Translator SHALL log the operation success
3. WHEN translation fails, THE Request_Translator SHALL log the error with details
4. THE Request_Translator SHALL log preserved Unknown_Fields for debugging
5. THE Request_Translator SHALL use structured logging with appropriate log levels (info, warn, error)

### Requirement 9: Handle Message Format Differences

**User Story:** As a developer, I want message format differences handled correctly, so that conversations translate accurately between formats.

#### Acceptance Criteria

1. WHEN Response API messages contain role and content fields, THE Request_Translator SHALL map them to Chat Completions message format
2. WHEN Response API messages contain tool calls, THE Request_Translator SHALL map them to Chat Completions tool_calls format
3. WHEN Response API messages contain function calls (legacy), THE Request_Translator SHALL map them appropriately
4. WHEN message arrays are empty, THE Request_Translator SHALL handle them without errors
5. FOR ALL message translations, the semantic meaning SHALL be preserved

### Requirement 10: Support Tool and Function Call Translation

**User Story:** As a developer using tools and functions, I want them translated correctly, so that tool-based interactions work across both API formats.

#### Acceptance Criteria

1. WHEN a Response API request contains tools array, THE Request_Translator SHALL map each tool to Chat Completions tool format
2. WHEN a Response API request contains tool_choice, THE Request_Translator SHALL map it to Chat Completions tool_choice format
3. WHEN tool definitions differ between formats, THE Request_Translator SHALL normalize them to Chat Completions schema
4. WHEN tools array is empty, THE Request_Translator SHALL omit it from the translated request
5. FOR ALL tool translations, the functional behavior SHALL remain equivalent

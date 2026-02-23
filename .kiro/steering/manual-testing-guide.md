---
inclusion: manual
---

# Manual Testing Guide - OpenAI Adapter

## Overview

This guide explains how to manually test the current implementation of the OpenAI Adapter using curl, Postman, or similar tools.

**Current Implementation Status**:
- ✅ Pass-through mode: Requests forwarded unchanged to upstream API
- ✅ Chat→Response translation: Chat Completions requests translated to Response API format
- ❌ Response→Chat translation: Not yet implemented
- ✅ Health/Readiness endpoints: Kubernetes probes working

---

## Prerequisites

### 1. Install Dependencies
```bash
npm ci
```

### 2. Build TypeScript
```bash
npm run build
```

### 3. Set Up Environment

Create a `.env` file in the project root:

```bash
# Option A: Use real OpenAI API (requires valid API key)
ADAPTER_TARGET_URL=https://api.openai.com/v1
MODEL_API_MAPPING_FILE=./config/model-mapping.json
PORT=3000
LOG_PRETTY=1

# Option B: Use mock server (for testing without real API calls)
ADAPTER_TARGET_URL=http://localhost:3001
MODEL_API_MAPPING_FILE=./config/model-mapping.json
PORT=3000
LOG_PRETTY=1
```

### 4. Start the Adapter

```bash
# Terminal 1: Start adapter
PORT=3000 npm start

# You should see:
# {"level":"info","msg":"Configuration loaded successfully",...}
# {"level":"info","action":"server_started","port":3000}
```

### 5. Verify Server is Running

```bash
# Terminal 2: Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok"}
```

---

## Model Mapping Reference

The adapter uses `config/model-mapping.json` to determine routing:

```json
{
  "gpt-4": "response",              // Chat request → Response API
  "gpt-4-turbo": "response",        // Chat request → Response API
  "gpt-4-vision": "response",       // Chat request → Response API
  "gpt-3.5-turbo": "chat_completions",  // Response request → Chat API
  "gpt-3.5-turbo-16k": "chat_completions"  // Response request → Chat API
}
```

**Key Points**:
- Models mapped to `"response"`: Chat Completions requests will be translated to Response API format
- Models mapped to `"chat_completions"`: Response API requests will be translated to Chat Completions format
- If source and target match: Pass-through (no translation)

---

## Test Scenarios

### Scenario 1: Pass-Through Mode (No Translation)

**Setup**: Send Chat Completions request with model mapped to `chat_completions`

**Request**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "temperature": 0.7
  }'
```

**Expected Behavior**:
1. Request arrives at `/v1/chat/completions`
2. Router detects source format: `chat_completions`
3. Router looks up model `gpt-3.5-turbo` → target is `chat_completions`
4. Decision: Pass-through (no translation needed)
5. Request forwarded to upstream as-is
6. Response returned as-is

**Expected Response** (from OpenAI):
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

**Logs** (with `LOG_PRETTY=1`):
```
routing_decision endpoint=chat/completions model=gpt-3.5-turbo source_format=chat_completions target_format=chat_completions decision=pass-through
pass_through_request endpoint=chat/completions model=gpt-3.5-turbo status=200
```

---

### Scenario 2: Chat→Response Translation

**Setup**: Send Chat Completions request with model mapped to `response`

**Request**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "What is 2+2?"
      }
    ],
    "temperature": 0.5,
    "max_tokens": 100
  }'
```

**Expected Behavior**:
1. Request arrives at `/v1/chat/completions`
2. Router detects source format: `chat_completions`
3. Router looks up model `gpt-4` → target is `response`
4. Decision: Translation needed (Chat→Response)
5. Request translated to Response API format
6. Translated request forwarded to upstream
7. Response received from upstream (Response API format)
8. Response translated back to Chat Completions format
9. Response returned to client in Chat format

**Translated Request** (what gets sent upstream):
```json
{
  "model": "gpt-4",
  "input": [
    {
      "role": "user",
      "content": "What is 2+2?"
    }
  ],
  "temperature": 0.5,
  "max_tokens": 100
}
```

**Expected Response** (translated back to Chat format):
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "2+2 equals 4."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 8,
    "completion_tokens": 5,
    "total_tokens": 13
  }
}
```

**Logs** (with `LOG_PRETTY=1`):
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
translation_completed endpoint=chat/completions model=gpt-4
pass_through_request endpoint=responses model=gpt-4 status=200
```

---

### Scenario 3: Health Check

**Request**:
```bash
curl http://localhost:3000/health
```

**Expected Response**:
```json
{
  "status": "ok"
}
```

**Status Code**: 200

**Notes**:
- Always returns 200 if process is alive
- No configuration checks
- Bypasses connection limits
- Not logged (to avoid clutter)

---

### Scenario 4: Readiness Check

**Request**:
```bash
curl http://localhost:3000/ready
```

**Expected Response** (if config valid):
```json
{
  "status": "ready",
  "checks": {
    "config": "ok"
  }
}
```

**Status Code**: 200

**Expected Response** (if config invalid):
```json
{
  "status": "not_ready",
  "checks": {
    "config": "failed"
  },
  "message": "Configuration validation failed"
}
```

**Status Code**: 503

---

### Scenario 5: Invalid Model (Not in Mapping)

**Request**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "unknown-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected Response**:
```json
{
  "error": "Bad Request",
  "message": "Model 'unknown-model' not found in model mapping",
  "requestId": "req-123abc"
}
```

**Status Code**: 400

**Logs**:
```
routing_error error=Model 'unknown-model' not found in model mapping
```

---

### Scenario 6: Payload Too Large

**Request**:
```bash
# Create a very large payload (> maxRequestSizeBytes)
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "'"$(printf 'x%.0s' {1..10000000})"'"}]
  }'
```

**Expected Response**:
```json
{
  "error": "Payload Too Large",
  "message": "Request payload exceeds maximum size of 1MB",
  "requestId": "req-123abc"
}
```

**Status Code**: 400

---

### Scenario 7: JSON Too Deep (DoS Prevention)

**Request**:
```bash
# Create deeply nested JSON
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}],
    "metadata": {"a": {"b": {"c": {"d": {"e": {"f": {"g": {"h": {"i": {"j": {"k": "too deep"}}}}}}}}}}}
  }'
```

**Expected Response**:
```json
{
  "error": "JSON Depth Exceeded",
  "message": "JSON depth exceeds maximum allowed depth of 20",
  "requestId": "req-123abc"
}
```

**Status Code**: 400

---

### Scenario 8: Missing Authorization Header

**Request**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected Behavior**:
- Request forwarded to upstream (adapter doesn't validate auth)
- Upstream API returns 401 Unauthorized
- Response passed through to client

**Expected Response** (from OpenAI):
```json
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

**Status Code**: 401

---

## Testing with Mock Server

For testing without real OpenAI API calls, use a mock server:

### Option 1: Simple Node.js Mock Server

Create `mock-server.js`:
```javascript
import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/v1/chat/completions') {
    res.writeHead(200);
    res.end(JSON.stringify({
      id: 'mock-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Mock response' },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }));
  } else if (req.url === '/v1/responses') {
    res.writeHead(200);
    res.end(JSON.stringify({
      id: 'mock-456',
      object: 'response',
      created: Date.now(),
      model: 'gpt-4',
      output: [{ role: 'assistant', content: 'Mock response' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3001, () => console.log('Mock server on :3001'));
```

Run it:
```bash
node mock-server.js
```

Then set in `.env`:
```
ADAPTER_TARGET_URL=http://localhost:3001
```

### Option 2: Use Postman Mock Server

1. Create a Postman collection with example responses
2. Deploy as mock server
3. Set `ADAPTER_TARGET_URL` to mock server URL

---

## Testing with Postman

### Import Collection

1. Open Postman
2. Create new collection: "OpenAI Adapter Tests"
3. Add requests:

**Request 1: Health Check**
```
GET http://localhost:3000/health
```

**Request 2: Readiness Check**
```
GET http://localhost:3000/ready
```

**Request 3: Chat Pass-Through**
```
POST http://localhost:3000/v1/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer sk-your-api-key

Body (raw JSON):
{
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.7
}
```

**Request 4: Chat→Response Translation**
```
POST http://localhost:3000/v1/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer sk-your-api-key

Body (raw JSON):
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "What is 2+2?"}],
  "temperature": 0.5
}
```

---

## Debugging Tips

### 1. Enable Pretty Logging

```bash
LOG_PRETTY=1 npm start
```

This makes logs more readable in development.

### 2. Check Logs for Routing Decision

Look for `routing_decision` log entry:
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
```

This tells you:
- Which endpoint was called
- Which model was used
- What the routing decision was (pass-through or translate)

### 3. Check Translation Logs

Look for `translation_completed` log entry:
```
translation_completed endpoint=chat/completions model=gpt-4
```

This confirms translation succeeded.

### 4. Check Pass-Through Logs

Look for `pass_through_request` log entry:
```
pass_through_request endpoint=responses model=gpt-4 status=200
```

This shows:
- Which endpoint was forwarded
- What status code was returned from upstream

### 5. Check Error Logs

Look for error entries:
```
routing_error error=Model 'unknown-model' not found in model mapping
```

This helps identify what went wrong.

### 6. Use Request ID for Tracing

Every response includes a `requestId`:
```json
{
  "error": "Bad Request",
  "message": "...",
  "requestId": "req-123abc"
}
```

Search logs for this ID to trace the full request flow.

---

## Common Issues & Solutions

### Issue 1: "Connection refused" to upstream

**Cause**: Upstream API not running or wrong URL

**Solution**:
1. Check `ADAPTER_TARGET_URL` is correct
2. Verify upstream API is running
3. Test upstream directly: `curl https://api.openai.com/v1/models -H "Authorization: Bearer sk-..."`

### Issue 2: "Model not found in mapping"

**Cause**: Model not in `config/model-mapping.json`

**Solution**:
1. Check model name is spelled correctly
2. Add model to `config/model-mapping.json`
3. Restart adapter

### Issue 3: "Request payload exceeds maximum size"

**Cause**: Request body too large

**Solution**:
1. Reduce request size
2. Or increase `maxRequestSizeBytes` in config
3. Restart adapter

### Issue 4: "JSON depth exceeds maximum"

**Cause**: Request has too deeply nested JSON

**Solution**:
1. Flatten JSON structure
2. Or increase `maxJsonDepth` in config
3. Restart adapter

### Issue 5: "Gateway Timeout"

**Cause**: Upstream API took too long to respond

**Solution**:
1. Check upstream API status
2. Increase `UPSTREAM_TIMEOUT_SECONDS` in `.env`
3. Restart adapter

---

## Performance Testing

### Test Connection Limits

```bash
# Terminal 1: Start adapter
npm start

# Terminal 2: Send many concurrent requests
for i in {1..1010}; do
  curl -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' &
done
wait

# Expected: First 1000 succeed, next 10 get 503 Service Unavailable
```

### Test Timeout

```bash
# Set short timeout
UPSTREAM_TIMEOUT_SECONDS=1 npm start

# Send request to slow upstream
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# Expected: 504 Gateway Timeout after 1 second
```

---

## Next Steps

After manual testing:

1. **Run automated tests**:
   ```bash
   npm run test:unit
   npm run test:integration:local
   ```

2. **Check test coverage**:
   ```bash
   npm run test:unit -- --coverage
   ```

3. **Follow implementation plan** to add Response→Chat translation:
   - See `.kiro/steering/implementation-plan.md`

---

## References

- Architecture: `.kiro/steering/architecture.md`
- Project Standards: `.kiro/steering/project-standards.md`
- Implementation Plan: `.kiro/steering/implementation-plan.md`
- Model Mapping: `config/model-mapping.json`

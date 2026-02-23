# Manual Testing Quick Start - OpenAI Adapter

## Current Implementation Status
- ✅ **Pass-through mode**: Requests forwarded unchanged to upstream API
- ✅ **Chat→Response translation**: Chat Completions requests translated to Response API format
- ❌ Response→Chat translation: Not yet implemented
- ✅ Health/Readiness endpoints: Kubernetes probes working

---

## Quick Setup (2 minutes)

### 1. Install & Build
```bash
npm ci
npm run build
```

### 2. Create `.env` file
```bash
# For testing with mock server (recommended)
ADAPTER_TARGET_URL=http://localhost:3001
MODEL_API_MAPPING_FILE=./config/model-mapping.json
PORT=3000
LOG_PRETTY=1
```

### 3. Start Adapter (Terminal 1)
```bash
npm start
```

Expected output:
```
{"level":"info","msg":"Configuration loaded successfully",...}
{"level":"info","action":"server_started","port":3000}
```

### 4. Start Mock Server (Terminal 2)
```bash
node mock-server.js
```

See "Mock Server Setup" section below for the mock-server.js code.

---

## Test Commands (Copy & Paste Ready)

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```
**Expected**: `{"status":"ok"}` (200)

---

### Test 2: Readiness Check
```bash
curl http://localhost:3000/ready
```
**Expected**: `{"status":"ready","checks":{"config":"ok"}}` (200)

---

### Test 3: Pass-Through Mode (Chat→Chat)
Model `gpt-3.5-turbo` is mapped to `chat_completions`, so no translation occurs.

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
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

**Expected Flow**:
1. Request arrives at `/v1/chat/completions`
2. Router detects: source=`chat_completions`, target=`chat_completions`
3. Decision: **Pass-through** (no translation)
4. Request forwarded to upstream as-is
5. Response returned as-is

**Expected Response**:
```json
{
  "id": "mock-123",
  "object": "chat.completion",
  "created": 1708123456,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Mock response"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

### Test 4: Chat→Response Translation
Model `gpt-4` is mapped to `response`, so translation occurs.

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
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

**Expected Flow**:
1. Request arrives at `/v1/chat/completions`
2. Router detects: source=`chat_completions`, target=`response`
3. Decision: **Translate** (Chat→Response)
4. Request translated to Response API format
5. Translated request forwarded to `/v1/responses` upstream
6. Response received from upstream (Response API format)
7. Response translated back to Chat Completions format
8. Response returned to client in Chat format

**Translated Request Sent Upstream**:
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
  "id": "chatcmpl-mock-456",
  "object": "chat.completion",
  "created": 1708123456,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Mock response"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

### Test 5: Invalid Model (Error Case)
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "unknown-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected Response** (400):
```json
{
  "error": "Bad Request",
  "message": "Model 'unknown-model' not found in model mapping",
  "requestId": "req-..."
}
```

---

### Test 6: Payload Too Large (Error Case)
```bash
# Create a 2MB payload (exceeds default 1MB limit)
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "'"$(printf 'x%.0s' {1..2000000})"'"}]
  }'
```

**Expected Response** (400):
```json
{
  "error": "Payload Too Large",
  "message": "Request payload exceeds maximum size of 1MB",
  "requestId": "req-..."
}
```

---

### Test 7: JSON Too Deep (Error Case)
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}],
    "metadata": {"a": {"b": {"c": {"d": {"e": {"f": {"g": {"h": {"i": {"j": {"k": {"l": {"m": {"n": {"o": {"p": {"q": {"r": {"s": {"t": {"u": "too deep"}}}}}}}}}}}}}}}}}}}}}
  }'
```

**Expected Response** (400):
```json
{
  "error": "JSON Depth Exceeded",
  "message": "JSON depth exceeds maximum allowed depth of 20",
  "requestId": "req-..."
}
```

---

## Mock Server Setup

Create `mock-server.js` in project root:

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

server.listen(3001, () => console.log('Mock server listening on :3001'));
```

Run it:
```bash
node mock-server.js
```

---

## Model Mapping Reference

From `config/model-mapping.json`:

| Model | Target | Behavior |
|-------|--------|----------|
| `gpt-4` | `response` | Chat request → Response API (translates) |
| `gpt-4-turbo` | `response` | Chat request → Response API (translates) |
| `gpt-4-vision` | `response` | Chat request → Response API (translates) |
| `gpt-3.5-turbo` | `chat_completions` | Chat request → Chat API (pass-through) |
| `gpt-3.5-turbo-16k` | `chat_completions` | Chat request → Chat API (pass-through) |

---

## Debugging Tips

### 1. Check Logs for Routing Decision
Look for `routing_decision` in logs:
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
```

### 2. Check Translation Logs
Look for `translation_completed`:
```
translation_completed endpoint=chat/completions model=gpt-4
```

### 3. Check Pass-Through Logs
Look for `pass_through_request`:
```
pass_through_request endpoint=responses model=gpt-4 status=200
```

### 4. Use Request ID for Tracing
Every error response includes `requestId`. Search logs for this ID to trace the full flow.

### 5. Enable Pretty Logging
```bash
LOG_PRETTY=1 npm start
```

---

## Automated Tests

After manual testing, run automated tests:

```bash
# Unit tests only
npm run test:unit

# Integration tests (requires mock server)
npm run test:integration:local

# All tests with coverage
npm run test:unit -- --coverage
```

---

## What's Implemented vs. Not Yet

### ✅ Implemented
- **Pass-through mode**: Requests forwarded unchanged when source and target protocols match
- **Chat→Response translation**: Full bidirectional translation for Chat Completions → Response API
  - Request translation: Chat format → Response format
  - Response translation: Response format → Chat format
- **Health/Readiness endpoints**: Kubernetes probes
- **Connection limiting**: Enforces max concurrent connections
- **Request validation**: Size and JSON depth limits
- **Error handling**: Clear error messages with request IDs
- **Routing logic**: Model mapping-based routing decisions

### ❌ Not Yet Implemented
- **Response→Chat translation**: Response API requests → Chat Completions format
- **Streaming responses**: Large response handling
- **Caching**: Request/response caching
- **Rate limiting**: Per-client rate limiting
- **Metrics**: Prometheus metrics
- **Additional providers**: Anthropic, Gemini, etc.

---

## Next Steps

1. **Verify current implementation** using tests above
2. **Run automated test suite**: `npm run test:integration:local`
3. **Implement Response→Chat translation** (see implementation plan)
4. **Add streaming support** for large responses
5. **Deploy to Kubernetes** with health/readiness probes

---

## References

- Full Manual Testing Guide: `.kiro/steering/manual-testing-guide.md`
- Architecture: `.kiro/steering/architecture.md`
- Project Standards: `.kiro/steering/project-standards.md`
- Implementation Plan: `.kiro/steering/implementation-plan.md`

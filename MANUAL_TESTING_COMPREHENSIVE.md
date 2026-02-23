# Comprehensive Manual Testing Guide - OpenAI Adapter

## Overview

This guide provides detailed instructions for manually testing the current implementation:
- ✅ **Pass-through mode**: Requests forwarded unchanged when source and target protocols match
- ✅ **Chat→Response translation**: Full bidirectional translation for Chat Completions → Response API
- ✅ **Health/Readiness endpoints**: Kubernetes probes
- ✅ **Error handling**: Validation and routing errors

---

## Quick Start (5 minutes)

### Prerequisites
- Node.js 20+
- `npm` installed
- Two terminal windows

### Step 1: Install Dependencies
```bash
npm ci
npm run build
```

### Step 2: Create `.env` File
```bash
cat > .env << 'EOF'
ADAPTER_TARGET_URL=http://localhost:3001
MODEL_API_MAPPING_FILE=./config/model-mapping.json
PORT=3000
LOG_PRETTY=1
UPSTREAM_TIMEOUT_SECONDS=30
MAX_CONCURRENT_CONNECTIONS=100
EOF
```

### Step 3: Start Mock Server (Terminal 1)
```bash
node mock-server.js
```

Expected output:
```
Mock server listening on :3001
```

### Step 4: Start Adapter (Terminal 2)
```bash
npm start
```

Expected output:
```
{"level":"info","msg":"Configuration loaded successfully",...}
{"level":"info","action":"server_started","port":3000}
```

---

## Mock Server Setup

Create `mock-server.js` in project root:

```javascript
import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  console.log(`[Mock Server] ${req.method} ${req.url}`);
  
  if (req.url === '/v1/chat/completions') {
    res.writeHead(200);
    res.end(JSON.stringify({
      id: 'chatcmpl-mock-123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-3.5-turbo',
      choices: [{
        index: 0,
        message: { 
          role: 'assistant', 
          content: 'This is a mock response from the chat completions endpoint.' 
        },
        finish_reason: 'stop'
      }],
      usage: { 
        prompt_tokens: 10, 
        completion_tokens: 15, 
        total_tokens: 25 
      }
    }));
  } else if (req.url === '/v1/responses') {
    res.writeHead(200);
    res.end(JSON.stringify({
      id: 'resp-mock-456',
      object: 'response',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      output: [{ 
        role: 'assistant', 
        content: 'This is a mock response from the response API endpoint.' 
      }],
      usage: { 
        prompt_tokens: 10, 
        completion_tokens: 15, 
        total_tokens: 25 
      }
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Mock server listening on :3001');
});
```

---

## Test Scenarios

### Test 1: Health Check (Liveness Probe)

**Purpose**: Verify the adapter process is alive

**Command**:
```bash
curl -v http://localhost:3000/health
```

**Expected Response** (200):
```json
{
  "status": "ok"
}
```

**What's Tested**:
- Server is running
- Health endpoint is accessible
- No connection limit enforcement (health bypasses limits)

---

### Test 2: Readiness Check (Readiness Probe)

**Purpose**: Verify the adapter is ready to accept traffic

**Command**:
```bash
curl -v http://localhost:3000/ready
```

**Expected Response** (200):
```json
{
  "status": "ready",
  "checks": {
    "config": "ok"
  }
}
```

**What's Tested**:
- Configuration is valid
- Adapter is ready to accept requests
- Readiness endpoint bypasses connection limits

---

## Pass-Through Mode Tests

### Test 3: Pass-Through - Chat→Chat (gpt-3.5-turbo)

**Purpose**: Verify requests are forwarded unchanged when source and target protocols match

**Model Mapping**: `gpt-3.5-turbo` → `chat_completions` (no translation)

**Command**:
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
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

**Expected Flow**:
1. Request arrives at `/v1/chat/completions`
2. Router detects: source=`chat_completions`, target=`chat_completions`
3. Decision: **Pass-through** (no translation needed)
4. Request forwarded to upstream `/v1/chat/completions` as-is
5. Response returned as-is

**Expected Response** (200):
```json
{
  "id": "chatcmpl-mock-123",
  "object": "chat.completion",
  "created": 1708123456,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This is a mock response from the chat completions endpoint."
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

**Logs to Look For**:
```
routing_decision endpoint=chat/completions model=gpt-3.5-turbo source_format=chat_completions target_format=chat_completions decision=pass-through
pass_through_request endpoint=chat/completions model=gpt-3.5-turbo status=200
```

---

## Chat→Response Translation Tests

### Test 4: Chat→Response Translation (gpt-4)

**Purpose**: Verify Chat Completions requests are translated to Response API format

**Model Mapping**: `gpt-4` → `response` (translation required)

**Command**:
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
4. Request translated from Chat format to Response format
5. Translated request forwarded to upstream `/v1/responses`
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

**Expected Response** (200 - translated back to Chat format):
```json
{
  "id": "chatcmpl-resp-mock-456",
  "object": "chat.completion",
  "created": 1708123456,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This is a mock response from the response API endpoint."
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

**Logs to Look For**:
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
translation_completed endpoint=chat/completions model=gpt-4
pass_through_request endpoint=responses model=gpt-4 status=200
```

---

### Test 5: Chat→Response with Multiple Messages (Multi-turn)

**Purpose**: Verify multi-turn conversations are handled correctly

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "What is 2+2?"
      },
      {
        "role": "assistant",
        "content": "2+2 equals 4."
      },
      {
        "role": "user",
        "content": "What is 3+3?"
      }
    ],
    "temperature": 0.5
  }'
```

**Expected Behavior**:
- All messages preserved in translation
- Multi-turn conversation detected in logs
- Response translated back correctly

**Logs to Look For**:
```
translation_completed endpoint=chat/completions model=gpt-4 multi_turn_detected=true
```

---

### Test 6: Chat→Response with System Message

**Purpose**: Verify system messages are preserved during translation

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful math tutor."
      },
      {
        "role": "user",
        "content": "Explain how to solve quadratic equations."
      }
    ],
    "temperature": 0.7
  }'
```

**Expected Behavior**:
- System message included in translation
- Response includes system message context
- Translation successful

---

## Error Handling Tests

### Test 7: Invalid Model (400 Error)

**Purpose**: Verify error handling for unknown models

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "unknown-model-xyz",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected Response** (400):
```json
{
  "error": "Bad Request",
  "message": "Model 'unknown-model-xyz' not found in model mapping",
  "requestId": "req-..."
}
```

**What's Tested**:
- Model validation
- Error response format
- Request ID included for tracing

---

### Test 8: Missing Required Field (400 Error)

**Purpose**: Verify validation of required fields

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4"
  }'
```

**Expected Response** (400):
```json
{
  "error": "Bad Request",
  "message": "Missing required field: messages",
  "requestId": "req-..."
}
```

**What's Tested**:
- Required field validation
- Clear error messages

---

### Test 9: Payload Too Large (400 Error)

**Purpose**: Verify request size limits are enforced

**Command** (creates ~2MB payload):
```bash
# Generate a large payload
LARGE_CONTENT=$(printf 'x%.0s' {1..2000000})

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4\",
    \"messages\": [{\"role\": \"user\", \"content\": \"$LARGE_CONTENT\"}]
  }"
```

**Expected Response** (400):
```json
{
  "error": "Payload Too Large",
  "message": "Request payload exceeds maximum size of 1MB",
  "requestId": "req-..."
}
```

**What's Tested**:
- Request size validation
- Payload limit enforcement
- Clear error message with limit

---

### Test 10: JSON Too Deep (400 Error)

**Purpose**: Verify JSON depth limits prevent DoS attacks

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}],
    "metadata": {
      "a": {
        "b": {
          "c": {
            "d": {
              "e": {
                "f": {
                  "g": {
                    "h": {
                      "i": {
                        "j": {
                          "k": {
                            "l": {
                              "m": {
                                "n": {
                                  "o": {
                                    "p": {
                                      "q": {
                                        "r": {
                                          "s": {
                                            "t": {
                                              "u": "too deep"
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
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

**What's Tested**:
- JSON depth validation
- DoS prevention
- Clear error message with limit

---

### Test 11: Invalid JSON (400 Error)

**Purpose**: Verify malformed JSON is rejected

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"
  }'
```

**Expected Response** (400):
```json
{
  "error": "Bad Request",
  "message": "Invalid JSON",
  "requestId": "req-..."
}
```

**What's Tested**:
- JSON parsing validation
- Error handling for malformed input

---

### Test 12: Connection Limit Exceeded (503 Error)

**Purpose**: Verify connection limiting prevents resource exhaustion

**Setup**: Modify `.env` to set a low connection limit:
```bash
MAX_CONCURRENT_CONNECTIONS=1
```

**Command** (run in two terminals simultaneously):

Terminal 1 (long-running request):
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Terminal 2 (while Terminal 1 is still running):
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected Response** (503):
```json
{
  "error": "Service Unavailable",
  "message": "Maximum concurrent connections exceeded",
  "requestId": "req-..."
}
```

**What's Tested**:
- Connection limiting
- Resource protection
- Graceful degradation

---

## Advanced Testing Scenarios

### Test 13: Verify Request ID Tracing

**Purpose**: Verify request IDs are included in all responses for tracing

**Command**:
```bash
curl -v -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }' 2>&1 | grep -i "x-request-id\|requestId"
```

**Expected Behavior**:
- Response includes `requestId` field
- Request ID is consistent across logs
- Can be used to trace full request flow

---

### Test 14: Verify Logging Output

**Purpose**: Verify structured logging is working correctly

**Setup**: Ensure `LOG_PRETTY=1` is set in `.env`

**Command**:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

**Expected Logs** (in adapter terminal):
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
translation_completed endpoint=chat/completions model=gpt-4
pass_through_request endpoint=responses model=gpt-4 status=200
```

**What's Tested**:
- Structured JSON logging
- Log levels (info, debug, warn, error)
- Contextual information in logs

---

### Test 15: Verify Health Endpoint Doesn't Log

**Purpose**: Verify health/readiness endpoints don't clutter logs

**Command** (run multiple times):
```bash
for i in {1..5}; do
  curl http://localhost:3000/health
  sleep 1
done
```

**Expected Behavior**:
- No log entries for health checks
- Logs remain clean and focused on actual requests

---

## Testing Checklist

Use this checklist to verify all functionality:

### Health & Readiness
- [ ] Test 1: Health check returns 200
- [ ] Test 2: Readiness check returns 200
- [ ] Test 15: Health endpoint doesn't log

### Pass-Through Mode
- [ ] Test 3: Chat→Chat pass-through works
- [ ] Logs show `decision=pass-through`
- [ ] Response is unchanged from upstream

### Chat→Response Translation
- [ ] Test 4: Chat→Response translation works
- [ ] Test 5: Multi-turn conversations handled
- [ ] Test 6: System messages preserved
- [ ] Logs show `decision=translate`
- [ ] Response translated back to Chat format

### Error Handling
- [ ] Test 7: Invalid model returns 400
- [ ] Test 8: Missing field returns 400
- [ ] Test 9: Payload too large returns 400
- [ ] Test 10: JSON too deep returns 400
- [ ] Test 11: Invalid JSON returns 400
- [ ] Test 12: Connection limit returns 503

### Logging & Tracing
- [ ] Test 13: Request IDs included in responses
- [ ] Test 14: Structured logging working
- [ ] All errors include request ID

---

## Debugging Tips

### 1. Enable Pretty Logging
```bash
LOG_PRETTY=1 npm start
```

### 2. Check Routing Decision
Look for `routing_decision` in logs to see what the router decided:
```
routing_decision endpoint=chat/completions model=gpt-4 source_format=chat_completions target_format=response decision=translate
```

### 3. Check Translation Status
Look for `translation_completed` or `translation_failed`:
```
translation_completed endpoint=chat/completions model=gpt-4
```

### 4. Trace Full Request Flow
Use the request ID to find all related log entries:
```bash
# In logs, search for the request ID
grep "req-abc123" adapter.log
```

### 5. Check Mock Server Logs
The mock server logs all incoming requests:
```
[Mock Server] POST /v1/responses
[Mock Server] POST /v1/chat/completions
```

### 6. Verify Configuration Loaded
Check startup logs for configuration details:
```
Configuration loaded successfully targetUrl=http://localhost:3001 modelCount=5
```

---

## Model Mapping Reference

From `config/model-mapping.json`:

| Model | Target | Behavior | Test |
|-------|--------|----------|------|
| `gpt-4` | `response` | Chat→Response translation | Test 4 |
| `gpt-4-turbo` | `response` | Chat→Response translation | Test 4 |
| `gpt-4-vision` | `response` | Chat→Response translation | Test 4 |
| `gpt-3.5-turbo` | `chat_completions` | Pass-through | Test 3 |
| `gpt-3.5-turbo-16k` | `chat_completions` | Pass-through | Test 3 |

---

## Automated Tests

After manual testing, run automated tests:

```bash
# Unit tests only
npm run test:unit

# Integration tests (requires mock server running)
npm run test:integration:local

# All tests with coverage
npm run test:unit -- --coverage

# Full CI pipeline
npm run test:ci
```

---

## Troubleshooting

### Adapter Won't Start
```bash
# Check configuration
cat .env

# Check logs
npm start 2>&1 | head -20

# Verify model mapping file exists
ls -la config/model-mapping.json
```

### Connection Refused to Mock Server
```bash
# Verify mock server is running
curl http://localhost:3001/v1/chat/completions

# Check ADAPTER_TARGET_URL in .env
grep ADAPTER_TARGET_URL .env
```

### Port Already in Use
```bash
# Change port in .env
echo "PORT=3001" >> .env

# Or kill existing process
lsof -i :3000
kill -9 <PID>
```

### Translation Not Happening
```bash
# Check model mapping
cat config/model-mapping.json

# Check logs for routing decision
# Should show: decision=translate
```

---

## Next Steps

1. **Run all tests** using the checklist above
2. **Verify logs** match expected output
3. **Run automated tests**: `npm run test:integration:local`
4. **Check coverage**: `npm run test:unit -- --coverage`
5. **Deploy to Docker**: `docker-compose up --build`

---

## References

- Quick Start: `MANUAL_TESTING_QUICK_START.md`
- Docker Testing: `DOCKER_TESTING_GUIDE.md`
- Architecture: `.kiro/steering/architecture.md`
- Project Standards: `.kiro/steering/project-standards.md`
- Implementation Plan: `.kiro/steering/implementation-plan.md`

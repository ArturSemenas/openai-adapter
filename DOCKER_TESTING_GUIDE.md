# Docker Compose Testing Guide - OpenAI Adapter

## Quick Start with Docker Compose

The project includes a complete Docker Compose setup for easy testing without manual npm commands.

### Prerequisites
- Docker and Docker Compose installed
- Port 3000 available (or modify in docker-compose.yml)

---

## Option 1: Test with Real OpenAI API

### 1. Set Up Environment
Edit `docker-compose.yml` and set your OpenAI API key:

```yaml
environment:
  - ADAPTER_TARGET_URL=https://api.openai.com
  - MODEL_API_MAPPING_FILE=/app/config/model-mapping.json
  - UPSTREAM_TIMEOUT_SECONDS=30
  - MAX_CONCURRENT_CONNECTIONS=100
```

### 2. Start the Adapter
```bash
docker-compose up --build
```

Expected output:
```
openai-adapter  | {"level":"info","msg":"Configuration loaded successfully",...}
openai-adapter  | {"level":"info","action":"server_started","port":3000}
```

### 3. Test Health Endpoint
```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}` (200)

### 4. Run Test Commands
Use any of the curl commands from the quick start guide. The adapter is now running in Docker.

---

## Option 2: Test with Mock Server (Recommended for Development)

This approach lets you test without hitting the real OpenAI API.

### 1. Create Mock Server Container

Create `docker-compose.mock.yml`:

```yaml
version: '3.9'

services:
  mock-server:
    image: node:20-alpine
    container_name: openai-mock-server
    working_dir: /app
    volumes:
      - ./mock-server.js:/app/mock-server.js
    ports:
      - "3001:3001"
    command: node mock-server.js
    networks:
      - adapter-network

  openai-adapter:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: openai-adapter
    ports:
      - "3000:3000"
    environment:
      # Point to mock server instead of real API
      - ADAPTER_TARGET_URL=http://mock-server:3001
      - MODEL_API_MAPPING_FILE=/app/config/model-mapping.json
      - UPSTREAM_TIMEOUT_SECONDS=30
      - MAX_CONCURRENT_CONNECTIONS=100
      - NODE_ENV=development
    
    volumes:
      - ./config:/app/config:ro
    
    depends_on:
      - mock-server
    
    networks:
      - adapter-network
    
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    
    restart: unless-stopped

networks:
  adapter-network:
    driver: bridge
```

### 2. Create Mock Server

Create `mock-server.js` in project root:

```javascript
import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  console.log(`[Mock Server] ${req.method} ${req.url}`);
  
  if (req.url === '/v1/chat/completions') {
    res.writeHead(200);
    res.end(JSON.stringify({
      id: 'mock-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Mock response from chat endpoint' },
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
      output: [{ role: 'assistant', content: 'Mock response from response endpoint' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
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

### 3. Start Both Services
```bash
docker-compose -f docker-compose.mock.yml up --build
```

Expected output:
```
mock-server         | Mock server listening on :3001
openai-adapter      | {"level":"info","msg":"Configuration loaded successfully",...}
openai-adapter      | {"level":"info","action":"server_started","port":3000}
```

### 4. Run Test Commands
All curl commands work the same way. The adapter will forward requests to the mock server.

---

## Docker Compose Test Commands

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

### Test 2: Readiness Check
```bash
curl http://localhost:3000/ready
```

### Test 3: Pass-Through Mode (Chat→Chat)
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7
  }'
```

### Test 4: Chat→Response Translation
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "temperature": 0.5,
    "max_tokens": 100
  }'
```

### Test 5: Invalid Model Error
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "unknown-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Docker Compose Management

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f openai-adapter
docker-compose logs -f mock-server
```

### Stop Services
```bash
docker-compose down
```

### Rebuild Image
```bash
docker-compose up --build
```

### Remove Everything (including volumes)
```bash
docker-compose down -v
```

### Check Service Status
```bash
docker-compose ps
```

---

## Docker Compose Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADAPTER_TARGET_URL` | Required | Upstream API base URL (e.g., `https://api.openai.com` or `http://mock-server:3001`) |
| `MODEL_API_MAPPING_FILE` | `/app/config/model-mapping.json` | Path to model mapping config |
| `UPSTREAM_TIMEOUT_SECONDS` | 30 | Timeout for upstream requests |
| `MAX_CONCURRENT_CONNECTIONS` | 100 | Max concurrent connections |
| `MAX_REQUEST_SIZE_MB` | 10 | Max request size in MB |
| `MAX_JSON_DEPTH` | 20 | Max JSON nesting depth |
| `NODE_ENV` | production | Node environment |

### Volumes

- `./config:/app/config:ro` - Model mapping configuration (read-only)

### Ports

- `3000:3000` - Adapter API
- `3001:3001` - Mock server (if using mock-compose)

### Health Check

The container includes a built-in health check that:
- Runs every 30 seconds
- Calls `/health` endpoint
- Marks container unhealthy after 3 failed checks
- Waits 5 seconds before first check

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs openai-adapter

# Verify configuration
docker-compose config
```

### Connection Refused to Upstream
- If using mock server: Ensure `ADAPTER_TARGET_URL=http://mock-server:3001`
- If using real API: Verify `ADAPTER_TARGET_URL=https://api.openai.com`
- Check both services are running: `docker-compose ps`

### Port Already in Use
Edit `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 on host instead of 3000
```

### View Container Logs
```bash
docker-compose logs -f openai-adapter
```

---

## Comparison: Docker vs. Local npm

| Aspect | Docker Compose | Local npm |
|--------|---|---|
| Setup | One command | Multiple steps |
| Isolation | Complete | Shares system |
| Dependencies | Bundled | Must install |
| Reproducibility | Guaranteed | Depends on system |
| Development | Slower rebuild | Faster iteration |
| Production | Ready to deploy | Needs containerization |

**Recommendation**: Use Docker Compose for testing and deployment, use local npm for development iteration.

---

## Next Steps

1. **Test with Docker Compose**: `docker-compose -f docker-compose.mock.yml up --build`
2. **Run curl commands** from the test section above
3. **Check logs**: `docker-compose logs -f`
4. **Verify all scenarios** work correctly
5. **Deploy to Kubernetes** using the same Docker image

---

## References

- Dockerfile: Multi-stage build with distroless runtime
- docker-compose.yml: Production-ready configuration
- Mock Server: Simple Node.js HTTP server for testing
- Manual Testing Guide: `.kiro/steering/manual-testing-guide.md`
- Quick Start: `MANUAL_TESTING_QUICK_START.md`

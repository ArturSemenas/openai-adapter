# openai-adapter

Minimal Node.js/TypeScript service scaffold for the OpenAI Adapter.

## Requirements

- Node.js 20+
- npm
- Docker (optional, for container build/run)


## Running locally

```bash
npm ci
npm run build
PORT=3000 node dist/index.js
```

## Operational Endpoints

### Health Endpoint (`/health`) - Liveness Probe

The health endpoint is a **liveness probe** used by container orchestration platforms (Kubernetes, Docker Swarm, etc.) to determine if the process is alive.

**Characteristics:**
- Always returns HTTP 200 if the process is running
- No configuration or dependency checks
- Ultra-lightweight, designed for frequent polling (every few seconds)
- Does not log requests to avoid clutter

**Request:**
```bash
curl http://localhost:3000/health
```

**Response (success):**
```json
{
  "status": "ok"
}
```

### Readiness Endpoint (`/ready`) - Readiness Probe

The readiness endpoint is a **readiness probe** used by load balancers and service meshes to determine if the instance can accept traffic.

**Characteristics:**
- Returns HTTP 200 when adapter is fully operational
- Returns HTTP 503 when adapter cannot accept traffic (e.g., configuration invalid)
- Verifies configuration is valid and loaded
- Does not log requests to avoid clutter
- Does NOT check external dependencies (Redis, upstream APIs) in MVP scope

**Request:**
```bash
curl http://localhost:3000/ready
```

**Response (ready):**
```json
{
  "status": "ready",
  "checks": {
    "config": "ok"
  }
}
```

**Response (not ready):**
```json
{
  "status": "not_ready",
  "checks": {
    "config": "failed"
  },
  "message": "Configuration validation failed"
}
```


## Environment variables

### Required

- `ADAPTER_TARGET_URL` — target OpenAI API base URL (e.g., `https://api.openai.com/v1`)
- `MODEL_API_MAPPING_FILE` — path to model-to-API mapping JSON file (e.g., `./config/model-mapping.json`)

### Optional

- `PORT` (default: `3000`) — server listen port
- `LOG_PRETTY` — set to `1` for pretty logs in development (requires `pino-pretty`)
- `UPSTREAM_TIMEOUT_SECONDS` (default: `60`) — upstream request timeout in seconds; must be a positive integer
- `MAX_CONCURRENT_CONNECTIONS` (default: `1000`) — maximum concurrent connections allowed; must be a positive integer

**Configuration Examples:**

```bash
# Standard configuration
ADAPTER_TARGET_URL=https://api.openai.com/v1 \
MODEL_API_MAPPING_FILE=./config/model-mapping.json \
PORT=3000 \
UPSTREAM_TIMEOUT_SECONDS=60 \
MAX_CONCURRENT_CONNECTIONS=1000 \
npm start

# High throughput configuration
ADAPTER_TARGET_URL=https://api.openai.com/v1 \
MODEL_API_MAPPING_FILE=./config/model-mapping.json \
UPSTREAM_TIMEOUT_SECONDS=120 \
MAX_CONCURRENT_CONNECTIONS=5000 \
npm start

# Conservative configuration for limited resources
ADAPTER_TARGET_URL=https://api.openai.com/v1 \
MODEL_API_MAPPING_FILE=./config/model-mapping.json \
UPSTREAM_TIMEOUT_SECONDS=30 \
MAX_CONCURRENT_CONNECTIONS=100 \
npm start
```

**Validation:**

- `UPSTREAM_TIMEOUT_SECONDS` must be a positive integer (1 or greater). Invalid values cause startup to fail with clear error message.
- `MAX_CONCURRENT_CONNECTIONS` must be a positive integer (1 or greater). When limit is reached, new requests receive HTTP 503 Service Unavailable.
- **Note:** Health (`/health`) and readiness (`/ready`) endpoints bypass the connection limit and are always available for orchestration platform health checks.

See [.env.example](.env.example) for a complete example.

## Docker

Build:

```bash
docker build -t openai-adapter:test .
```

Run:

```bash
docker run -p 3000:3000 openai-adapter:test
```

Health:

```bash
curl -f http://localhost:3000/health
```

## Testing

### Unit Tests


### Integration Tests (requires Docker)

### Full CI Pipeline Locally


This runs the complete CI flow:
1. Lint code
2. Run unit tests
3. Build TypeScript
4. Build Docker image
5. Test Docker health endpoint
6. Run integration tests

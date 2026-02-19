# Test Organization

This document describes the test structure and npm scripts for the openai-adapter project.

## Directory Structure

```
tests/
├── unit/                           # Unit tests - fast, isolated tests
│   ├── config/                     # Configuration module tests
│   │   ├── file-loader.test.ts    # Model mapping file loading
│   │   ├── loader.test.ts         # Configuration loading
│   │   ├── timeout-concurrency.test.ts  # Timeout & concurrency config
│   │   └── validator.test.ts      # Model mapping validation
│   └── server.test.ts             # Fastify server instance tests
│
└── integration/                    # Integration tests - combines smoke & regression
    ├── smoke/                      # Smoke tests - basic functionality verification
    │   └── smoke.test.ts          # Docker container health checks
    │
    └── regression/                 # Regression tests - prevent bugs from reappearing
        ├── concurrency-limiting.test.ts      # Connection limit enforcement (AC3)
        ├── health-readiness.test.ts          # Health/readiness endpoints
        ├── timeout-concurrency.test.ts       # Config integration with server
        └── regression.test.ts                # Docker configuration validation
```

## Test Categories

### Unit Tests (`tests/unit/`)
- **Purpose:** Test individual functions and modules in isolation
- **Speed:** Fast (<100ms per file)
- **Dependencies:** Minimal - no external services
- **When to run:** During development, before every commit

### Integration Tests (`tests/integration/`)
Integration tests are divided into two categories:

#### Smoke Tests (`tests/integration/smoke/`)
- **Purpose:** Verify basic system functionality in production-like environment
- **Speed:** Slow (5-10s per file)
- **Dependencies:** Docker container, real processes
- **When to run:** After build, before deployment

#### Regression Tests (`tests/integration/regression/`)
- **Purpose:** Ensure previously fixed bugs don't reappear and features work correctly
- **Speed:** Medium to Slow (2-35s per file)
- **Dependencies:** 
  - In-process tests: Fastify server instance (fast)
  - Docker tests: Real Docker containers (slow)
- **When to run:** In CI pipeline, before pull requests

## NPM Scripts

### Development

```bash
# Run all unit tests (fast feedback loop)
npm run test:unit

# Run smoke tests (requires Docker image)
npm run test:smoke

# Run all regression tests (mix of fast and slow)
npm run test:regression

# Run all integration tests (smoke + regression)
npm run test:integration

# Watch mode for TDD
npm run test:watch
```

### CI/CD

```bash
# Run all tests (default)
npm test

# Run all tests explicitly categorized
npm run test:all

# Run only Docker-dependent tests (smoke + Docker regression)
npm run test:integration:docker

# Build Docker image and run Docker tests
npm run test:integration:local

# Complete CI pipeline
npm run test:ci
```

### Test Script Details

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `vitest run` | Run all tests (default vitest behavior) |
| `test:unit` | `vitest run tests/unit` | Run only unit tests (51 tests) |
| `test:smoke` | `vitest run tests/integration/smoke` | Run smoke tests (3 tests) |
| `test:regression` | `vitest run tests/integration/regression` | Run all regression tests (61 tests) |
| `test:integration` | Runs `test:smoke` + `test:regression` | Complete integration suite (64 tests) |
| `test:integration:docker` | `vitest run tests/integration/smoke tests/integration/regression/regression.test.ts --config vitest.integration.config.ts` | Docker-dependent tests only |
| `test:integration:local` | Runs `docker:build` + `test:integration:docker` | Build and test Docker locally |
| `test:all` | Runs `test:unit` + `test:integration` | Every test in the project (115 tests) |
| `test:ci` | Full pipeline: `lint` + `test:unit` + `build` + `docker:build` + `test:integration:docker` | Complete CI validation |

## Test Counts

- **Unit tests:** 51 tests (5 files)
- **Smoke tests:** 3 tests (1 file)
- **Regression tests:** 61 tests (4 files)
  - In-process: 50 tests (3 files) - Fast Fastify tests
  - Docker: 11 tests (1 file) - Slow container tests
- **Total:** 115 tests (10 files)

## Guidelines

### When to Add a Unit Test
- Testing a pure function with no side effects
- Testing validation logic
- Testing data transformations
- Testing error handling for specific cases

### When to Add a Smoke Test
- Testing Docker container starts correctly
- Testing health endpoints are accessible
- Testing basic request/response flow
- Testing deployment readiness

### When to Add a Regression Test
- A bug was found and fixed (prevent reoccurrence)
- Testing feature acceptance criteria
- Testing configuration scenarios
- Testing integration between modules
- Docker-specific issues (use regression.test.ts)

## Configuration Files

- `vitest.config.ts` - Default configuration for unit and most integration tests
- `vitest.integration.config.ts` - Specialized configuration for Docker tests (longer timeouts)

## Best Practices

1. **Keep unit tests fast** - Mock external dependencies
2. **Smoke tests verify deployment readiness** - Use real Docker containers
3. **Regression tests document features and fixes** - Include clear test names
4. **Group related tests** - Place tests for the same area in one file
5. **Use descriptive test names** - Test name should explain what's being verified
6. **Follow AAA pattern** - Arrange, Act, Assert
7. **Clean up after yourself** - Use afterEach/beforeEach for setup/teardown

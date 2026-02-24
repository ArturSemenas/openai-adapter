# Docker Standards & Best Practices

## Docker Image Naming Convention

**CRITICAL**: Always use consistent, explicit naming to avoid image/container confusion.

### Standard Naming Format

```
<project-name>:<tag>
```

**For this project:**
- **Project name**: `openai-adapter` (fixed, never change)
- **Tags**: Use semantic tags based on purpose

### Required Tags

| Tag | Purpose | When to Use |
|-----|---------|-------------|
| `openai-adapter:latest` | Production-ready image | Main branch, stable releases |
| `openai-adapter:dev` | Development/testing | Local development, CI testing |
| `openai-adapter:test` | Integration testing | Running integration tests |
| `openai-adapter:v<version>` | Versioned releases | Semantic versioning (e.g., v0.1.0) |

### Image Naming Rules

1. **Always use explicit image names** - Never rely on Docker's default naming
2. **Use consistent project prefix** - All images must start with `openai-adapter:`
3. **Tag appropriately** - Use descriptive tags that indicate purpose
4. **Clean old images** - Remove unused images before building new ones
5. **Never use ambiguous names** - Avoid names like "adapter", "ai-adapter", etc.

## Container Naming Convention

**Format**: `<project-name>-<purpose>`

**For this project:**
- `openai-adapter-dev` - Development container
- `openai-adapter-test` - Test container
- `openai-adapter-prod` - Production container

### Container Naming Rules

1. **Always use explicit container names** via `--name` or `container_name`
2. **Match container name to image purpose** - Use same tag/purpose in name
3. **Use unique names per environment** - Avoid conflicts between dev/test/prod
4. **Clean old containers** - Remove stopped containers before creating new ones

## Docker Compose Configuration

### Standard docker-compose.yml Structure

```yaml
version: '3.9'

services:
  openai-adapter:
    # CRITICAL: Always specify explicit image name
    image: openai-adapter:dev
    
    # CRITICAL: Always specify explicit container name
    container_name: openai-adapter-dev
    
    build:
      context: .
      dockerfile: Dockerfile
      # Optional: Use build args for cache busting
      args:
        - BUILD_DATE=${BUILD_DATE:-unknown}
    
    # ... rest of configuration
```

### Key Points

1. **Always set `image:`** - Explicitly name the built image
2. **Always set `container_name:`** - Explicitly name the container
3. **Match naming** - Keep image and container names aligned
4. **Use build args** - For cache busting when needed

## NPM Scripts for Docker

### Standard Docker Scripts

```json
{
  "scripts": {
    "docker:build": "docker build -t openai-adapter:dev .",
    "docker:build:test": "docker build -t openai-adapter:test .",
    "docker:clean": "docker rm -f openai-adapter-dev openai-adapter-test 2>nul || true",
    "docker:clean:images": "docker rmi openai-adapter:dev openai-adapter:test 2>nul || true",
    "docker:clean:all": "npm run docker:clean && npm run docker:clean:images",
    "docker:rebuild": "npm run docker:clean:all && npm run docker:build"
  }
}
```

### Script Naming Rules

1. **Prefix with `docker:`** - All Docker scripts start with this prefix
2. **Use descriptive suffixes** - `:build`, `:clean`, `:test`, etc.
3. **Provide cleanup scripts** - Always have ways to clean containers and images
4. **Provide rebuild scripts** - Combine clean + build for fresh starts

## Common Docker Commands

### Building Images

```bash
# Development image
docker build -t openai-adapter:dev .

# Test image
docker build -t openai-adapter:test .

# Production image with version
docker build -t openai-adapter:v0.1.0 -t openai-adapter:latest .
```

### Running Containers

```bash
# Development container
docker run --name openai-adapter-dev -p 3000:3000 openai-adapter:dev

# Test container
docker run --name openai-adapter-test -p 3001:3000 openai-adapter:test

# Using docker-compose
docker-compose up -d
```

### Cleaning Up

```bash
# Remove specific container
docker rm -f openai-adapter-dev

# Remove specific image
docker rmi openai-adapter:dev

# Remove all project containers
docker rm -f $(docker ps -a -q --filter "name=openai-adapter")

# Remove all project images
docker rmi $(docker images -q openai-adapter)

# Nuclear option: Remove all unused images
docker image prune -a
```

### Listing Resources

```bash
# List all project images
docker images openai-adapter

# List all project containers
docker ps -a --filter "name=openai-adapter"

# Inspect image
docker inspect openai-adapter:dev

# Check image history
docker history openai-adapter:dev
```

## Troubleshooting Docker Issues

### Issue: Building new image but running old container

**Symptoms:**
- Code changes don't appear in running container
- Old behavior persists after rebuild
- Multiple images with similar names exist

**Root Cause:**
- Container is running from old image
- New image built but container not recreated
- Ambiguous naming causing wrong image to be used

**Solution:**
```bash
# 1. Stop and remove ALL related containers
docker rm -f $(docker ps -a -q --filter "name=openai-adapter")

# 2. Remove ALL related images
docker rmi $(docker images -q openai-adapter)

# 3. Rebuild with explicit naming
docker build -t openai-adapter:dev .

# 4. Run with explicit naming
docker run --name openai-adapter-dev -p 3000:3000 openai-adapter:dev
```

### Issue: Multiple images with similar names

**Symptoms:**
- `docker images` shows: adapter, ai-adapter, openai-adapter
- Confusion about which image to use
- Builds succeed but wrong image runs

**Root Cause:**
- Inconsistent naming across scripts and compose files
- Manual builds with different names
- Copy-paste errors with naming

**Solution:**
```bash
# 1. List all images to identify culprits
docker images

# 2. Remove all ambiguous images
docker rmi adapter ai-adapter openai-adapter

# 3. Standardize on ONE naming convention
docker build -t openai-adapter:dev .

# 4. Update all scripts to use consistent naming
```

### Issue: Docker Compose using wrong image

**Symptoms:**
- `docker-compose up` doesn't use latest build
- Changes not reflected in container
- Compose creates image with unexpected name

**Root Cause:**
- Missing `image:` field in docker-compose.yml
- Docker Compose generates default name based on directory
- Mismatch between build script and compose file

**Solution:**
```yaml
# Always specify explicit image name in docker-compose.yml
services:
  openai-adapter:
    image: openai-adapter:dev  # CRITICAL: Add this line
    container_name: openai-adapter-dev
    build:
      context: .
      dockerfile: Dockerfile
```

## CI/CD Best Practices

### GitHub Actions / CI Pipeline

```yaml
# Example CI workflow
- name: Build Docker image
  run: docker build -t openai-adapter:test .

- name: Run tests in container
  run: |
    docker run --name openai-adapter-test \
      -e NODE_ENV=test \
      openai-adapter:test npm test

- name: Cleanup
  if: always()
  run: docker rm -f openai-adapter-test
```

### Key CI/CD Rules

1. **Use `:test` tag** - Separate from dev/prod images
2. **Clean up after tests** - Always remove containers in CI
3. **Use explicit names** - Never rely on defaults in CI
4. **Tag for releases** - Use version tags for production deployments

## Cache Busting

### When to Bust Cache

- Source code changes not appearing in image
- Dependencies updated but not reflected
- Configuration changes not taking effect

### How to Bust Cache

```bash
# Option 1: No-cache build
docker build --no-cache -t openai-adapter:dev .

# Option 2: Build args (preferred)
docker build --build-arg BUILD_DATE=$(date +%Y%m%d-%H%M%S) -t openai-adapter:dev .

# Option 3: Remove image and rebuild
docker rmi openai-adapter:dev
docker build -t openai-adapter:dev .
```

### Cache Busting in Dockerfile

```dockerfile
# Add build arg for cache busting
ARG BUILD_DATE=unknown

# Use it in a layer to bust cache from that point
RUN echo "Build date: ${BUILD_DATE}"

# Or add as comment (already in current Dockerfile)
# CACHE BUSTER: 2026-02-23-20:50
```

## Quick Reference

### Before Every Build

```bash
# Check what exists
docker images openai-adapter
docker ps -a --filter "name=openai-adapter"

# Clean if needed
docker rm -f openai-adapter-dev
docker rmi openai-adapter:dev
```

### Standard Build & Run

```bash
# Build
docker build -t openai-adapter:dev .

# Run
docker run --name openai-adapter-dev -p 3000:3000 openai-adapter:dev

# Or use compose
docker-compose up -d
```

### Standard Cleanup

```bash
# Stop and remove container
docker-compose down

# Or manually
docker rm -f openai-adapter-dev

# Remove image
docker rmi openai-adapter:dev
```

## Checklist for Docker Operations

### Before Building
- [ ] Check existing images: `docker images openai-adapter`
- [ ] Check running containers: `docker ps --filter "name=openai-adapter"`
- [ ] Decide on appropriate tag (dev, test, latest)
- [ ] Clean old images/containers if needed

### During Build
- [ ] Use explicit image name with tag
- [ ] Verify build completes successfully
- [ ] Check image was created: `docker images openai-adapter`

### Before Running
- [ ] Verify correct image exists
- [ ] Check port availability
- [ ] Use explicit container name
- [ ] Clean old container if exists

### After Running
- [ ] Verify container started: `docker ps`
- [ ] Check logs: `docker logs openai-adapter-dev`
- [ ] Test health endpoint: `curl http://localhost:3000/health`

### When Troubleshooting
- [ ] List all images: `docker images`
- [ ] List all containers: `docker ps -a`
- [ ] Check container logs: `docker logs <container-name>`
- [ ] Inspect image: `docker inspect <image-name>`
- [ ] Try clean rebuild: Remove all, rebuild, rerun

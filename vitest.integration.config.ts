import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests (smoke + regression) - no excludes
    environment: 'node',
    testTimeout: 60_000, // Allow longer timeouts for container operations
  }
});

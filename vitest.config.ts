import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/integration/**'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'tests/**', '*.config.*']
    }
  }
});

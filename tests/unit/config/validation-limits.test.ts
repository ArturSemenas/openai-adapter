import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfiguration, parseIntegerEnvVar } from '../../../src/config/loader.js';

describe('Configuration Loading - Validation Limits', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Save current environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Payload Size Configuration', () => {
    it('should load default MAX_REQUEST_SIZE_MB of 10MB', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      // Unset the MAX_REQUEST_SIZE_MB to test default
      delete process.env.MAX_REQUEST_SIZE_MB;

      const config = await loadConfiguration();

      expect(config.maxRequestSizeBytes).toBe(10 * 1024 * 1024);
    });

    it('should parse MAX_REQUEST_SIZE_MB from environment', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_REQUEST_SIZE_MB = '20';

      const config = await loadConfiguration();

      expect(config.maxRequestSizeBytes).toBe(20 * 1024 * 1024);
    });

    it('should convert 1MB to correct bytes', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_REQUEST_SIZE_MB = '1';

      const config = await loadConfiguration();

      expect(config.maxRequestSizeBytes).toBe(1 * 1024 * 1024);
    });

    it('should convert 100MB to correct bytes', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_REQUEST_SIZE_MB = '100';

      const config = await loadConfiguration();

      expect(config.maxRequestSizeBytes).toBe(100 * 1024 * 1024);
    });
  });

  describe('JSON Depth Configuration', () => {
    it('should load default MAX_JSON_DEPTH of 100 levels', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      // Unset the MAX_JSON_DEPTH to test default
      delete process.env.MAX_JSON_DEPTH;

      const config = await loadConfiguration();

      expect(config.maxJsonDepth).toBe(100);
    });

    it('should parse MAX_JSON_DEPTH from environment', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_JSON_DEPTH = '50';

      const config = await loadConfiguration();

      expect(config.maxJsonDepth).toBe(50);
    });

    it('should handle custom MAX_JSON_DEPTH value', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_JSON_DEPTH = '200';

      const config = await loadConfiguration();

      expect(config.maxJsonDepth).toBe(200);
    });
  });

  describe('parseIntegerEnvVar behavior with size/depth limits', () => {
    it('should parse valid positive integers', () => {
      expect(parseIntegerEnvVar('10', 'TEST_VAR', 5, 1)).toBe(10);
      expect(parseIntegerEnvVar('1', 'TEST_VAR', 5, 1)).toBe(1);
      expect(parseIntegerEnvVar('100', 'TEST_VAR', 5, 1)).toBe(100);
    });

    it('should use default when undefined', () => {
      expect(parseIntegerEnvVar(undefined, 'TEST_VAR', 10, 1)).toBe(10);
      expect(parseIntegerEnvVar('', 'TEST_VAR', 10, 1)).toBe(10);
    });

    it('should reject invalid values for MAX_REQUEST_SIZE_MB', () => {
      expect(() => parseIntegerEnvVar('not-a-number', 'MAX_REQUEST_SIZE_MB', 10, 1)).toThrow();
      expect(() => parseIntegerEnvVar('-5', 'MAX_REQUEST_SIZE_MB', 10, 1)).toThrow();
      expect(() => parseIntegerEnvVar('0.5', 'MAX_REQUEST_SIZE_MB', 10, 1)).toThrow();
    });

    it('should enforce minimum value of 1', () => {
      expect(() => parseIntegerEnvVar('-1', 'MAX_JSON_DEPTH', 100, 1)).toThrow();
      expect(() => parseIntegerEnvVar('0', 'MAX_JSON_DEPTH', 100, 1)).toThrow();
    });
  });

  describe('Configuration consistency', () => {
    it('should include payload size bytes in config', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_REQUEST_SIZE_MB = '10';

      const config = await loadConfiguration();

      expect(config).toHaveProperty('maxRequestSizeBytes');
      expect(typeof config.maxRequestSizeBytes).toBe('number');
      expect(config.maxRequestSizeBytes).toBeGreaterThan(0);
    });

    it('should include JSON depth limit in config', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_JSON_DEPTH = '100';

      const config = await loadConfiguration();

      expect(config).toHaveProperty('maxJsonDepth');
      expect(typeof config.maxJsonDepth).toBe('number');
      expect(config.maxJsonDepth).toBeGreaterThan(0);
    });

    it('should maintain other config values when setting limits', async () => {
      process.env.ADAPTER_TARGET_URL = 'http://localhost:3000';
      process.env.MODEL_API_MAPPING_FILE = './config/model-mapping.json';
      process.env.MAX_REQUEST_SIZE_MB = '15';
      process.env.MAX_JSON_DEPTH = '75';
      process.env.UPSTREAM_TIMEOUT_SECONDS = '30';

      const config = await loadConfiguration();

      expect(config.targetUrl).toBe('http://localhost:3000');
      expect(config.maxRequestSizeBytes).toBe(15 * 1024 * 1024);
      expect(config.maxJsonDepth).toBe(75);
      expect(config.upstreamTimeoutSeconds).toBe(30);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvConfig } from '../../../src/config/loader.js';

describe('loadEnvConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load valid configuration', () => {
    process.env.ADAPTER_TARGET_URL = 'https://api.openai.com/v1';
    process.env.MODEL_API_MAPPING_FILE = '/path/to/mapping.json';

    const config = loadEnvConfig();

    expect(config.ADAPTER_TARGET_URL).toBe('https://api.openai.com/v1');
    expect(config.MODEL_API_MAPPING_FILE).toBe('/path/to/mapping.json');
  });

  it('should accept http URLs', () => {
    process.env.ADAPTER_TARGET_URL = 'http://localhost:8080';
    process.env.MODEL_API_MAPPING_FILE = '/path/to/mapping.json';

    const config = loadEnvConfig();

    expect(config.ADAPTER_TARGET_URL).toBe('http://localhost:8080');
  });

  it('should throw when ADAPTER_TARGET_URL is missing', () => {
    delete process.env.ADAPTER_TARGET_URL;
    process.env.MODEL_API_MAPPING_FILE = '/path/to/mapping.json';

    expect(() => loadEnvConfig()).toThrow(/ADAPTER_TARGET_URL/);
  });

  it('should throw when MODEL_API_MAPPING_FILE is missing', () => {
    process.env.ADAPTER_TARGET_URL = 'https://api.openai.com/v1';
    delete process.env.MODEL_API_MAPPING_FILE;

    expect(() => loadEnvConfig()).toThrow(/MODEL_API_MAPPING_FILE/);
  });

  it('should throw when ADAPTER_TARGET_URL is not a valid URL', () => {
    process.env.ADAPTER_TARGET_URL = 'not-a-url';
    process.env.MODEL_API_MAPPING_FILE = '/path/to/mapping.json';

    expect(() => loadEnvConfig()).toThrow();
  });

  it('should throw when ADAPTER_TARGET_URL is not http/https', () => {
    process.env.ADAPTER_TARGET_URL = 'ftp://api.openai.com/v1';
    process.env.MODEL_API_MAPPING_FILE = '/path/to/mapping.json';

    expect(() => loadEnvConfig()).toThrow();
  });
});

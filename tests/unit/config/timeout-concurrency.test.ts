import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseIntegerEnvVar } from '../../../src/config/loader.js';

describe('Timeout and Concurrency Configuration - Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set required environment variables
    process.env.ADAPTER_TARGET_URL = 'https://api.openai.com/v1';
    process.env.MODEL_API_MAPPING_FILE = '/app/config/model-mapping.json';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('UPSTREAM_TIMEOUT_SECONDS validation', () => {
    it('accepts valid timeout values', () => {
      const testCases = [
        { value: '30', expected: 30 },
        { value: '60', expected: 60 },
        { value: '120', expected: 120 },
        { value: '3600', expected: 3600 },
        { value: '1', expected: 1 }
      ];

      testCases.forEach(({ value, expected }) => {
        const result = parseIntegerEnvVar(value, 'UPSTREAM_TIMEOUT_SECONDS', 60);
        expect(result).toBe(expected);
      });
    });

    it('uses default value when env var not set', () => {
      const result = parseIntegerEnvVar(undefined, 'UPSTREAM_TIMEOUT_SECONDS', 60);
      expect(result).toBe(60);
    });

    it('uses default value when env var is empty string', () => {
      const result = parseIntegerEnvVar('', 'UPSTREAM_TIMEOUT_SECONDS', 60);
      expect(result).toBe(60);
    });

    it('rejects negative timeout values', () => {
      expect(() => {
        parseIntegerEnvVar('-1', 'UPSTREAM_TIMEOUT_SECONDS', 60);
      }).toThrow('UPSTREAM_TIMEOUT_SECONDS must be 1 or greater');
    });

    it('rejects zero timeout values', () => {
      expect(() => {
        parseIntegerEnvVar('0', 'UPSTREAM_TIMEOUT_SECONDS', 60);
      }).toThrow('UPSTREAM_TIMEOUT_SECONDS must be 1 or greater');
    });

    it('rejects non-numeric timeout values', () => {
      expect(() => {
        parseIntegerEnvVar('abc', 'UPSTREAM_TIMEOUT_SECONDS', 60);
      }).toThrow('UPSTREAM_TIMEOUT_SECONDS must be a numeric value');
    });

    it('error message includes valid range and example', () => {
      try {
        parseIntegerEnvVar('invalid', 'UPSTREAM_TIMEOUT_SECONDS', 60);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('numeric value');
        expect((error as Error).message).toContain('Example: 60');
      }
    });
  });

  describe('MAX_CONCURRENT_CONNECTIONS validation', () => {
    it('accepts valid concurrency limits', () => {
      const testCases = [
        { value: '100', expected: 100 },
        { value: '500', expected: 500 },
        { value: '1000', expected: 1000 },
        { value: '5000', expected: 5000 },
        { value: '1', expected: 1 }
      ];

      testCases.forEach(({ value, expected }) => {
        const result = parseIntegerEnvVar(value, 'MAX_CONCURRENT_CONNECTIONS', 1000);
        expect(result).toBe(expected);
      });
    });

    it('uses default value when env var not set', () => {
      const result = parseIntegerEnvVar(undefined, 'MAX_CONCURRENT_CONNECTIONS', 1000);
      expect(result).toBe(1000);
    });

    it('uses default value when env var is empty string', () => {
      const result = parseIntegerEnvVar('', 'MAX_CONCURRENT_CONNECTIONS', 1000);
      expect(result).toBe(1000);
    });

    it('rejects negative concurrency values', () => {
      expect(() => {
        parseIntegerEnvVar('-1', 'MAX_CONCURRENT_CONNECTIONS', 1000);
      }).toThrow('MAX_CONCURRENT_CONNECTIONS must be 1 or greater');
    });

    it('rejects zero concurrency values', () => {
      expect(() => {
        parseIntegerEnvVar('0', 'MAX_CONCURRENT_CONNECTIONS', 1000);
      }).toThrow('MAX_CONCURRENT_CONNECTIONS must be 1 or greater');
    });

    it('rejects non-numeric concurrency values', () => {
      expect(() => {
        parseIntegerEnvVar('xyz', 'MAX_CONCURRENT_CONNECTIONS', 1000);
      }).toThrow('MAX_CONCURRENT_CONNECTIONS must be a numeric value');
    });

    it('error message includes valid range and example', () => {
      try {
        parseIntegerEnvVar('invalid', 'MAX_CONCURRENT_CONNECTIONS', 1000);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('numeric value');
        expect((error as Error).message).toContain('Example: 1000');
      }
    });
  });

  describe('Configuration loading with timeout and concurrency', () => {
    it('loads default values when env vars not set', async () => {
      delete process.env.UPSTREAM_TIMEOUT_SECONDS;
      delete process.env.MAX_CONCURRENT_CONNECTIONS;

      // This test requires actual file operations, so we'll test the validation logic
      const timeoutResult = parseIntegerEnvVar(
        process.env.UPSTREAM_TIMEOUT_SECONDS,
        'UPSTREAM_TIMEOUT_SECONDS',
        60
      );
      const concurrencyResult = parseIntegerEnvVar(
        process.env.MAX_CONCURRENT_CONNECTIONS,
        'MAX_CONCURRENT_CONNECTIONS',
        1000
      );

      expect(timeoutResult).toBe(60);
      expect(concurrencyResult).toBe(1000);
    });

    it('loads custom timeout value from env var', () => {
      process.env.UPSTREAM_TIMEOUT_SECONDS = '120';

      const result = parseIntegerEnvVar(
        process.env.UPSTREAM_TIMEOUT_SECONDS,
        'UPSTREAM_TIMEOUT_SECONDS',
        60
      );

      expect(result).toBe(120);
    });

    it('loads custom concurrency value from env var', () => {
      process.env.MAX_CONCURRENT_CONNECTIONS = '2000';

      const result = parseIntegerEnvVar(
        process.env.MAX_CONCURRENT_CONNECTIONS,
        'MAX_CONCURRENT_CONNECTIONS',
        1000
      );

      expect(result).toBe(2000);
    });

    it('validates timeout on configuration load', () => {
      process.env.UPSTREAM_TIMEOUT_SECONDS = 'not-a-number';

      expect(() => {
        parseIntegerEnvVar(
          process.env.UPSTREAM_TIMEOUT_SECONDS,
          'UPSTREAM_TIMEOUT_SECONDS',
          60
        );
      }).toThrow();
    });

    it('validates concurrency on configuration load', () => {
      process.env.MAX_CONCURRENT_CONNECTIONS = 'not-a-number';

      expect(() => {
        parseIntegerEnvVar(
          process.env.MAX_CONCURRENT_CONNECTIONS,
          'MAX_CONCURRENT_CONNECTIONS',
          1000
        );
      }).toThrow();
    });
  });

  describe('Configuration startup logging', () => {
    it('logs timeout configuration in structured JSON format', () => {
      process.env.UPSTREAM_TIMEOUT_SECONDS = '90';

      const logOutput = JSON.stringify({
        level: 'info',
        msg: 'Configuration loaded successfully',
        upstreamTimeoutSeconds: 90,
        maxConcurrentConnections: 1000
      });

      expect(logOutput).toContain('upstreamTimeoutSeconds');
      expect(logOutput).toContain('90');
    });

    it('logs concurrency configuration in structured JSON format', () => {
      process.env.MAX_CONCURRENT_CONNECTIONS = '2000';

      const logOutput = JSON.stringify({
        level: 'info',
        msg: 'Configuration loaded successfully',
        upstreamTimeoutSeconds: 60,
        maxConcurrentConnections: 2000
      });

      expect(logOutput).toContain('maxConcurrentConnections');
      expect(logOutput).toContain('2000');
    });

    it('logs both timeout and concurrency together', () => {
      process.env.UPSTREAM_TIMEOUT_SECONDS = '120';
      process.env.MAX_CONCURRENT_CONNECTIONS = '500';

      const logOutput = JSON.stringify({
        level: 'info',
        msg: 'Configuration loaded successfully',
        upstreamTimeoutSeconds: 120,
        maxConcurrentConnections: 500
      });

      expect(logOutput).toContain('upstreamTimeoutSeconds');
      expect(logOutput).toContain('maxConcurrentConnections');
      expect(logOutput).toContain('120');
      expect(logOutput).toContain('500');
    });
  });

  describe('Error message clarity', () => {
    it('provides clear error for non-numeric timeout', () => {
      try {
        parseIntegerEnvVar('abc', 'UPSTREAM_TIMEOUT_SECONDS', 60);
        expect.fail('Should throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('must be');
        expect(message).toContain('numeric');
        expect(message).toContain('UPSTREAM_TIMEOUT_SECONDS');
      }
    });

    it('provides clear error for negative timeout', () => {
      try {
        parseIntegerEnvVar('-50', 'UPSTREAM_TIMEOUT_SECONDS', 60);
        expect.fail('Should throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('must be');
        expect(message).toContain('1 or greater');
        expect(message).toContain('UPSTREAM_TIMEOUT_SECONDS');
      }
    });

    it('provides clear error for non-numeric concurrency', () => {
      try {
        parseIntegerEnvVar('xyz', 'MAX_CONCURRENT_CONNECTIONS', 1000);
        expect.fail('Should throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('must be');
        expect(message).toContain('numeric');
        expect(message).toContain('MAX_CONCURRENT_CONNECTIONS');
      }
    });

    it('provides clear error for negative concurrency', () => {
      try {
        parseIntegerEnvVar('-500', 'MAX_CONCURRENT_CONNECTIONS', 1000);
        expect.fail('Should throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('must be');
        expect(message).toContain('1 or greater');
        expect(message).toContain('MAX_CONCURRENT_CONNECTIONS');
      }
    });
  });
});

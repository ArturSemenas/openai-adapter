import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';

describe('Regression Tests - Docker Image Validation', () => {
  const imageName = process.env.DOCKER_IMAGE || 'openai-adapter:test';

  it('configures non-root user', () => {
    const user = execSync(`docker inspect ${imageName} --format="{{.Config.User}}"`, {
      encoding: 'utf-8'
    }).trim();

    expect(user).not.toBe('');
    expect(user).not.toBe('root');
    expect(user).not.toBe('0');
  });

  it('has image size under 250MB', () => {
    const sizeBytes = execSync(`docker inspect ${imageName} --format="{{.Size}}"`, {
      encoding: 'utf-8'
    }).trim();

    const sizeMB = Number(sizeBytes) / (1024 * 1024);
    expect(sizeMB).toBeLessThan(250);
  });

  it('exposes port 3000', () => {
    const ports = execSync(`docker inspect ${imageName} --format="{{json .Config.ExposedPorts}}"`, {
      encoding: 'utf-8'
    }).trim();

    expect(ports).toContain('3000/tcp');
  });

  it('sets NODE_ENV to production', () => {
    const env = execSync(`docker inspect ${imageName} --format="{{json .Config.Env}}"`, {
      encoding: 'utf-8'
    }).trim();

    expect(env).toContain('NODE_ENV=production');
  });
});

describe('Regression Tests - Configuration Validation', () => {
  const imageName = process.env.DOCKER_IMAGE || 'openai-adapter:test';
  const dockerRunTimeoutMs = 15_000;

  interface DockerError {
    status?: number;
    stderr?: string;
    stdout?: string;
    message?: string;
  }

  function getDockerOutput(error: DockerError): string {
    return String(error?.stderr || error?.stdout || error?.message || '');
  }

  it('fails to start with missing ADAPTER_TARGET_URL', () => {
    try {
      execSync(
        `docker run --rm -e MODEL_API_MAPPING_FILE=/app/config/model-mapping.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      // If we get here, container didn't fail
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      // Container should exit with non-zero code
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('ADAPTER_TARGET_URL');
    }
  });

  it('fails to start with invalid URL format', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=not-a-url -e MODEL_API_MAPPING_FILE=/app/config/model-mapping.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
    }
  });

  it('fails to start with missing MODEL_API_MAPPING_FILE', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=https://api.openai.com/v1 ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('MODEL_API_MAPPING_FILE');
    }
  });

  it('fails to start with non-existent mapping file', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=https://api.openai.com/v1 -e MODEL_API_MAPPING_FILE=/nonexistent/file.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('not found');
    }
  });

  it('fails to start with invalid JSON in mapping file', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=https://api.openai.com/v1 -e MODEL_API_MAPPING_FILE=/app/config/model-mapping.invalid.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('Invalid JSON');
    }
  });

  it('fails to start with invalid API type in mapping file', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=https://api.openai.com/v1 -e MODEL_API_MAPPING_FILE=/app/config/model-mapping.invalid-api-type.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('Invalid API type');
      expect(getDockerOutput(dockerError)).toContain('gpt-4');
    }
  });

  it('fails to start with duplicate model names in mapping file', () => {
    try {
      execSync(
        `docker run --rm -e ADAPTER_TARGET_URL=https://api.openai.com/v1 -e MODEL_API_MAPPING_FILE=/app/config/model-mapping.duplicate-keys.json ${imageName}`,
        { encoding: 'utf-8', timeout: dockerRunTimeoutMs }
      );
      expect.fail('Container should have exited with error');
    } catch (error) {
      const dockerError = error as DockerError;
      expect(dockerError.status).not.toBe(0);
      expect(getDockerOutput(dockerError)).toContain('Duplicate model name');
      expect(getDockerOutput(dockerError)).toContain('model-1');
    }
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

describe('Smoke Tests - Docker Container Health', () => {
  let container: StartedTestContainer;
  let baseUrl: string;

  beforeAll(async () => {
    const imageName = process.env.DOCKER_IMAGE || 'openai-adapter:test';
    
    console.log(`Starting container from image: ${imageName}`);
    container = await new GenericContainer(imageName)
      .withExposedPorts(3000)
      .withEnvironment({
        ADAPTER_TARGET_URL: 'https://api.openai.com/v1',
        MODEL_API_MAPPING_FILE: '/app/config/model-mapping.json'
      })
      .withWaitStrategy(Wait.forLogMessage('Server listening at'))
      .withStartupTimeout(30_000)
      .start();

    const mappedPort = container.getMappedPort(3000);
    baseUrl = `http://${container.getHost()}:${mappedPort}`;
    console.log(`Container started at: ${baseUrl}`);
    
    // Give the server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 60_000);

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  it('responds to health endpoint', async () => {
    const response = await fetch(`${baseUrl}/health`);
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  it('serves requests within acceptable time', async () => {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/health`);
    const duration = Date.now() - start;
    
    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(1000); // Should respond in <1s
  });

  it('returns JSON content-type', async () => {
    const response = await fetch(`${baseUrl}/health`);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});

export type ApiType = 'response' | 'chat_completions';

export type ModelMapping = Record<string, ApiType>;

export interface AdapterConfig {
  targetUrl: string;
  modelMappingFile: string;
  modelMapping: ModelMapping;
  upstreamTimeoutSeconds: number;
  maxConcurrentConnections: number;
  maxRequestSizeBytes: number;
  maxJsonDepth: number;
}

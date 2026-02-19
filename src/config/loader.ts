import envSchema from 'env-schema';
import { readFile } from 'node:fs/promises';
import type { AdapterConfig, ModelMapping } from './types.js';
import { validateModelMapping } from './validator.js';

interface EnvConfig {
  ADAPTER_TARGET_URL: string;
  MODEL_API_MAPPING_FILE: string;
  UPSTREAM_TIMEOUT_SECONDS?: string;
  MAX_CONCURRENT_CONNECTIONS?: string;
  MAX_REQUEST_SIZE_MB?: string;
  MAX_JSON_DEPTH?: string;
}

const schema = {
  type: 'object',
  required: ['ADAPTER_TARGET_URL', 'MODEL_API_MAPPING_FILE'],
  properties: {
    ADAPTER_TARGET_URL: {
      type: 'string',
      minLength: 1
    },
    MODEL_API_MAPPING_FILE: {
      type: 'string',
      minLength: 1
    },
    UPSTREAM_TIMEOUT_SECONDS: {
      type: 'string'
    },
    MAX_CONCURRENT_CONNECTIONS: {
      type: 'string'
    },
    MAX_REQUEST_SIZE_MB: {
      type: 'string'
    },
    MAX_JSON_DEPTH: {
      type: 'string'
    }
  }
} as const;

export function loadEnvConfig(): EnvConfig {
  try {
    const config = envSchema<EnvConfig>({
      schema,
      data: process.env,
      dotenv: false
    });
    
    // Validate URL format using URL constructor
    try {
      const url = new URL(config.ADAPTER_TARGET_URL);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('URL must use http:// or https:// protocol');
      }
    } catch (urlError) {
      throw new Error(
        `ADAPTER_TARGET_URL is not a valid HTTP/HTTPS URL: ${config.ADAPTER_TARGET_URL}. ` +
        'Set ADAPTER_TARGET_URL to a valid HTTP/HTTPS URL like https://api.openai.com/v1'
      );
    }
    
    return config;
  } catch (error) {
    if (error instanceof Error) {
      let message = `Environment variable validation failed: ${error.message}.`;
      
      // Add resolution guidance for missing variables only
      if (error.message.includes('MODEL_API_MAPPING_FILE') && !error.message.includes('Set')) {
        message += ' Set MODEL_API_MAPPING_FILE to the path of your JSON configuration file.';
      }
      
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Parse and validate an integer environment variable
 * @param value The string value to parse
 * @param variableName The name of the variable (for error messages)
 * @param defaultValue The default value if not provided
 * @param minValue The minimum allowed value
 * @returns The parsed integer value
 * @throws Error if value is invalid
 */
export function parseIntegerEnvVar(
  value: string | undefined,
  variableName: string,
  defaultValue: number,
  minValue: number = 1
): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(
      `${variableName} must be a numeric value. Example: ${defaultValue}`
    );
  }

  if (parsed < minValue) {
    throw new Error(
      `${variableName} must be ${minValue} or greater. Example: ${defaultValue}`
    );
  }

  return parsed;
}

function detectDuplicateKeys(jsonContent: string): void {
  // Check for duplicate keys at the top level only by parsing character by character
  const keys = new Set<string>();
  let inString = false;
  let escape = false;
  let currentKey = '';
  let collectingKey = false;
  let depth = 0;
  
  for (let i = 0; i < jsonContent.length; i++) {
    const char = jsonContent[i];
    
    if (escape) {
      if (collectingKey) currentKey += char;
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      if (collectingKey) currentKey += char;
      continue;
    }
    
    if (char === '"') {
      if (inString) {
        inString = false;
        if (collectingKey && depth === 1) {
          // End of key at top level
          collectingKey = false;
          if (keys.has(currentKey)) {
            throw new Error(`Duplicate model name found in mapping file: "${currentKey}"`);
          }
          keys.add(currentKey);
          currentKey = '';
        }
      } else {
        inString = true;
        if (depth === 1 && !collectingKey) {
          // Start of potential key at top level
          const remainingContent = jsonContent.slice(i);
          const keyMatch = remainingContent.match(/^"[^"]*"\s*:/);
          if (keyMatch) {
            collectingKey = true;
            currentKey = '';
          }
        }
      }
      continue;
    }
    
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') depth--;
    } else if (collectingKey) {
      currentKey += char;
    }
  }
}

export async function loadModelMappingFile(filePath: string): Promise<ModelMapping> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Check for duplicates before parsing
    try {
      detectDuplicateKeys(content);
    } catch (wsError) {
      // If regex fails or finds dupes, we prioritize that error if it looks like a duplicate key error
      if (wsError instanceof Error && wsError.message.includes('Duplicate model name')) {
        throw wsError;
      }
      // Otherwise proceed to JSON.parse to handle syntax errors properly
    }

    try {
      const parsed = JSON.parse(content);
      return parsed as ModelMapping;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON in model mapping file: ${parseError.message}`
        );
      }
      throw parseError;
    }
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(
          `Model mapping file not found at path: ${filePath}. ` +
          `Ensure the file exists and MODEL_API_MAPPING_FILE is set correctly.`
        );
      }
      if ('code' in error && error.code === 'EACCES') {
        throw new Error(
          `Cannot read model mapping file at ${filePath}. Check file permissions.`
        );
      }
      throw error;
    }
    throw error;
  }
}

export async function loadConfiguration(): Promise<AdapterConfig> {
  const envConfig = loadEnvConfig();
  
  const rawMapping = await loadModelMappingFile(envConfig.MODEL_API_MAPPING_FILE);
  const modelMapping = validateModelMapping(rawMapping);

  // Parse timeout and concurrency with defaults
  const upstreamTimeoutSeconds = parseIntegerEnvVar(
    envConfig.UPSTREAM_TIMEOUT_SECONDS,
    'UPSTREAM_TIMEOUT_SECONDS',
    60,
    1
  );

  const maxConcurrentConnections = parseIntegerEnvVar(
    envConfig.MAX_CONCURRENT_CONNECTIONS,
    'MAX_CONCURRENT_CONNECTIONS',
    1000,
    1
  );

  // Parse request size limit (default 10MB)
  const maxRequestSizeMB = parseIntegerEnvVar(
    envConfig.MAX_REQUEST_SIZE_MB,
    'MAX_REQUEST_SIZE_MB',
    10,
    1
  );
  const maxRequestSizeBytes = maxRequestSizeMB * 1024 * 1024;

  // Parse JSON depth limit (default 100 levels)
  const maxJsonDepth = parseIntegerEnvVar(
    envConfig.MAX_JSON_DEPTH,
    'MAX_JSON_DEPTH',
    100,
    1
  );
  
  return {
    targetUrl: envConfig.ADAPTER_TARGET_URL,
    modelMappingFile: envConfig.MODEL_API_MAPPING_FILE,
    modelMapping,
    upstreamTimeoutSeconds,
    maxConcurrentConnections,
    maxRequestSizeBytes,
    maxJsonDepth
  };
}

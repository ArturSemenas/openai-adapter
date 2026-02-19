import type { ApiType, ModelMapping } from './types.js';

const VALID_API_TYPES: readonly ApiType[] = ['response', 'chat_completions'];

export function validateModelMapping(mapping: unknown): ModelMapping {
  // Validate it's an object
  if (typeof mapping !== 'object' || mapping === null || Array.isArray(mapping)) {
    throw new Error('Model mapping must be an object');
  }

  // Validate all values are valid API types
  const invalidEntries: Array<{ model: string; value: unknown }> = [];

  for (const [model, apiType] of Object.entries(mapping)) {
    if (!VALID_API_TYPES.includes(apiType as ApiType)) {
      invalidEntries.push({ model, value: apiType });
    }
  }

  if (invalidEntries.length > 0) {
    const errorLines = invalidEntries.map(
      ({ model, value }) =>
        `  - Model "${model}": "${value}" is not valid. Must be "response" or "chat_completions"`
    );

    throw new Error(
      `Invalid API type values in model mapping:\n${errorLines.join('\n')}`
    );
  }

  return mapping as ModelMapping;
}

import type { ApiType, ModelMapping } from '../config/types.js';

/**
 * ModelMapper - Looks up which API format a model should use
 * Immutable at runtime (loaded once at startup)
 */
export class ModelMapper {
  constructor(private readonly mapping: ModelMapping) {}

  /**
   * Get the target API type for a given model
   * @param model The model name (e.g., "gpt-4", "gpt-3.5-turbo")
   * @returns The target API type ("response" or "chat_completions")
   * @throws Error if model is not found in mapping
   */
  getTargetApi(model: string): ApiType {
    const targetApi = this.mapping[model];
    
    if (!targetApi) {
      throw new Error(`Model "${model}" not found in mapping`);
    }
    
    return targetApi;
  }

  /**
   * Check if a model exists in the mapping
   * @param model The model name
   * @returns true if model exists, false otherwise
   */
  hasModel(model: string): boolean {
    return model in this.mapping;
  }

  /**
   * Get all mapped models
   * @returns Array of model names
   */
  getMappedModels(): string[] {
    return Object.keys(this.mapping);
  }
}

import { describe, it, expect } from 'vitest';
import { ModelMapper } from '../../../src/routing/model-mapper.js';
import type { ModelMapping } from '../../../src/config/types.js';

describe('ModelMapper', () => {
  const testMapping: ModelMapping = {
    'gpt-4': 'response',
    'gpt-4-turbo': 'response',
    'gpt-3.5-turbo': 'chat_completions',
    'gpt-3.5-turbo-16k': 'chat_completions',
    'gpt-4o': 'response',
    'gpt-4o-mini': 'response'
  };

  describe('getTargetApi', () => {
    it('should return "response" for gpt-4', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.getTargetApi('gpt-4')).toBe('response');
    });

    it('should return "chat_completions" for gpt-3.5-turbo', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.getTargetApi('gpt-3.5-turbo')).toBe('chat_completions');
    });

    it('should return "response" for gpt-4-turbo', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.getTargetApi('gpt-4-turbo')).toBe('response');
    });

    it('should return "response" for gpt-4o', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.getTargetApi('gpt-4o')).toBe('response');
    });

    it('should return "response" for gpt-4o-mini', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.getTargetApi('gpt-4o-mini')).toBe('response');
    });

    it('should throw error for unmapped model', () => {
      const mapper = new ModelMapper(testMapping);
      expect(() => mapper.getTargetApi('unknown-model')).toThrow(
        'Model "unknown-model" not found in mapping'
      );
    });

    it('should throw error for empty string model', () => {
      const mapper = new ModelMapper(testMapping);
      expect(() => mapper.getTargetApi('')).toThrow(
        'Model "" not found in mapping'
      );
    });
  });

  describe('hasModel', () => {
    it('should return true for mapped model', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.hasModel('gpt-4')).toBe(true);
      expect(mapper.hasModel('gpt-3.5-turbo')).toBe(true);
    });

    it('should return false for unmapped model', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.hasModel('unknown-model')).toBe(false);
    });

    it('should return false for empty string', () => {
      const mapper = new ModelMapper(testMapping);
      expect(mapper.hasModel('')).toBe(false);
    });
  });

  describe('getMappedModels', () => {
    it('should return all mapped models', () => {
      const mapper = new ModelMapper(testMapping);
      const models = mapper.getMappedModels();
      
      expect(models).toHaveLength(6);
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-3.5-turbo-16k');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
    });

    it('should return empty array for empty mapping', () => {
      const mapper = new ModelMapper({});
      expect(mapper.getMappedModels()).toEqual([]);
    });
  });

  describe('empty mapping', () => {
    it('should throw error for any model when mapping is empty', () => {
      const mapper = new ModelMapper({});
      expect(() => mapper.getTargetApi('gpt-4')).toThrow(
        'Model "gpt-4" not found in mapping'
      );
    });

    it('should return false for hasModel with empty mapping', () => {
      const mapper = new ModelMapper({});
      expect(mapper.hasModel('gpt-4')).toBe(false);
    });
  });
});

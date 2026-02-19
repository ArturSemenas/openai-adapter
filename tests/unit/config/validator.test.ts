import { describe, it, expect } from 'vitest';
import { validateModelMapping } from '../../../src/config/validator.js';

describe('validateModelMapping', () => {
  it('should accept valid mapping with response API type', () => {
    const mapping = { 'gpt-4': 'response' };
    expect(() => validateModelMapping(mapping)).not.toThrow();
  });

  it('should accept valid mapping with chat_completions API type', () => {
    const mapping = { 'gpt-3.5-turbo': 'chat_completions' };
    expect(() => validateModelMapping(mapping)).not.toThrow();
  });

  it('should accept valid mapping with multiple models', () => {
    const mapping = {
      'gpt-4': 'response',
      'gpt-3.5-turbo': 'chat_completions',
      'gpt-4-turbo': 'response'
    };
    expect(() => validateModelMapping(mapping)).not.toThrow();
  });

  it('should reject non-object values', () => {
    expect(() => validateModelMapping('not an object')).toThrow(/must be an object/);
  });

  it('should reject null', () => {
    expect(() => validateModelMapping(null)).toThrow(/must be an object/);
  });

  it('should reject arrays', () => {
    expect(() => validateModelMapping([])).toThrow(/must be an object/);
  });

  it('should reject invalid API type', () => {
    const mapping = { 'gpt-4': 'invalid_type' };
    expect(() => validateModelMapping(mapping)).toThrow(/Invalid API type/);
    expect(() => validateModelMapping(mapping)).toThrow(/gpt-4/);
  });

  it('should reject multiple invalid API types and list them all', () => {
    const mapping = {
      'gpt-4': 'respond',
      'gpt-3.5': 'chat'
    };
    
    expect(() => validateModelMapping(mapping)).toThrow(/Invalid API type/);
    expect(() => validateModelMapping(mapping)).toThrow(/gpt-4/);
    expect(() => validateModelMapping(mapping)).toThrow(/gpt-3.5/);
  });

  it('should specify allowed values in error message', () => {
    const mapping = { 'gpt-4': 'wrong' };
    
    try {
      validateModelMapping(mapping);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('response');
      expect((error as Error).message).toContain('chat_completions');
    }
  });

  it('should accept empty mapping', () => {
    const mapping = {};
    expect(() => validateModelMapping(mapping)).not.toThrow();
  });
});

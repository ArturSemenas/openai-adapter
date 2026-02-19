/**
 * Unit tests for unknown-fields utility
 */

import { describe, it, expect } from 'vitest';
import {
  detectUnknownChatFields,
  detectUnknownResponseFields,
  isDroppedField,
  getKnownChatFields,
  getKnownResponseFields,
  getDroppedFields
} from '../../../src/translation/utils/unknown-fields.js';

describe('Unknown Fields Utility', () => {
  describe('detectUnknownChatFields', () => {
    it('should detect unknown fields in Chat Completions request', () => {
      const payload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        custom_field_1: 'value1',
        custom_field_2: 123
      };

      const result = detectUnknownChatFields(payload);

      expect(result.unknownFields).toContain('custom_field_1');
      expect(result.unknownFields).toContain('custom_field_2');
      expect(result.unknownFields).not.toContain('model');
      expect(result.unknownFields).not.toContain('messages');
      expect(result.unknownFields).not.toContain('temperature');
    });

    it('should pass through all fields in cleaned payload', () => {
      const payload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        custom_field: 'value'
      };

      const result = detectUnknownChatFields(payload);

      expect(result.cleanedPayload).toEqual(payload);
    });

    it('should handle empty unknown fields', () => {
      const payload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7
      };

      const result = detectUnknownChatFields(payload);

      expect(result.unknownFields).toHaveLength(0);
    });
  });

  describe('detectUnknownResponseFields', () => {
    it('should detect unknown fields in Response API request', () => {
      const payload = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.7,
        custom_field: 'value'
      };

      const result = detectUnknownResponseFields(payload);

      expect(result.unknownFields).toContain('custom_field');
      expect(result.unknownFields).not.toContain('model');
      expect(result.unknownFields).not.toContain('input');
    });

    it('should handle text object with nested fields', () => {
      const payload = {
        model: 'gpt-4',
        input: 'Hello',
        text: {
          format: 'json',
          custom_text_field: 'value'
        }
      };

      const result = detectUnknownResponseFields(payload);

      expect(result.unknownFields.some((f) => f.includes('text.'))).toBe(true);
    });
  });

  describe('isDroppedField', () => {
    it('should identify dropped fields', () => {
      expect(isDroppedField('frequency_penalty')).toBe(true);
      expect(isDroppedField('presence_penalty')).toBe(true);
      expect(isDroppedField('n')).toBe(true);
      expect(isDroppedField('stop')).toBe(true);
    });

    it('should not flag known fields as dropped', () => {
      expect(isDroppedField('model')).toBe(false);
      expect(isDroppedField('temperature')).toBe(false);
      expect(isDroppedField('messages')).toBe(false);
    });

    it('should not flag unknown fields as dropped', () => {
      expect(isDroppedField('custom_field')).toBe(false);
    });
  });

  describe('getKnownChatFields', () => {
    it('should return array of known Chat Completions fields', () => {
      const fields = getKnownChatFields();

      expect(fields).toContain('model');
      expect(fields).toContain('messages');
      expect(fields).toContain('temperature');
      expect(Array.isArray(fields)).toBe(true);
    });
  });

  describe('getKnownResponseFields', () => {
    it('should return array of known Response API fields', () => {
      const fields = getKnownResponseFields();

      expect(fields).toContain('model');
      expect(fields).toContain('input');
      expect(fields).toContain('instructions');
      expect(Array.isArray(fields)).toBe(true);
    });
  });

  describe('getDroppedFields', () => {
    it('should return array of dropped fields', () => {
      const fields = getDroppedFields();

      expect(fields).toContain('frequency_penalty');
      expect(fields).toContain('presence_penalty');
      expect(fields).toContain('n');
      expect(Array.isArray(fields)).toBe(true);
    });
  });
});

/**
 * Unit tests for round-trip-tester utility
 */

import { describe, it, expect } from 'vitest';
import {
  testChatToResponseRoundTrip,
  testResponseToChatRoundTrip,
  formatRoundTripResult
} from '../../../src/translation/utils/round-trip-tester.js';

describe('Round-Trip Tester Utility', () => {
  describe('testChatToResponseRoundTrip', () => {
    it('should pass round-trip with semantically equivalent requests', () => {
      const originalChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100
      };

      const translatedResponse = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.7,
        max_output_tokens: 100
      };

      const backTranslatedChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_completion_tokens: 100
      };

      const result = testChatToResponseRoundTrip(
        originalChat,
        translatedResponse,
        backTranslatedChat
      );

      expect(result.success).toBe(true);
      expect(result.semanticEquivalence.model).toBe(true);
      expect(result.semanticEquivalence.content).toBe(true);
      expect(result.semanticEquivalence.parameters).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should fail when model differs', () => {
      const originalChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const translatedResponse = {
        model: 'gpt-4',
        input: 'Hello'
      };

      const backTranslatedChat = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = testChatToResponseRoundTrip(
        originalChat,
        translatedResponse,
        backTranslatedChat
      );

      expect(result.success).toBe(false);
      expect(result.semanticEquivalence.model).toBe(false);
      expect(result.differences.some((d) => d.includes('model'))).toBe(true);
    });

    it('should fail when content differs', () => {
      const originalChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const translatedResponse = {
        model: 'gpt-4',
        input: 'Hello'
      };

      const backTranslatedChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Goodbye' }]
      };

      const result = testChatToResponseRoundTrip(
        originalChat,
        translatedResponse,
        backTranslatedChat
      );

      expect(result.success).toBe(false);
      expect(result.semanticEquivalence.content).toBe(false);
      expect(result.differences.some((d) => d.includes('content'))).toBe(true);
    });

    it('should fail when parameters differ', () => {
      const originalChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7
      };

      const translatedResponse = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.7
      };

      const backTranslatedChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5
      };

      const result = testChatToResponseRoundTrip(
        originalChat,
        translatedResponse,
        backTranslatedChat
      );

      expect(result.success).toBe(false);
      expect(result.semanticEquivalence.parameters).toBe(false);
      expect(result.differences.some((d) => d.includes('temperature'))).toBe(true);
    });

    it('should handle invalid input gracefully', () => {
      const result = testChatToResponseRoundTrip(
        null,
        {},
        null
      );

      // Invalid inputs still get compared; if they all extract to empty/undefined equivalence, it may show as success
      // This tests that the function doesn't crash, not that it definitively fails
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('differences');
    });

    it('should extract last message only for comparison', () => {
      const originalChat = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Second message' }
        ]
      };

      const translatedResponse = {
        model: 'gpt-4',
        input: 'Second message'
      };

      const backTranslatedChat = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: 'Second message' }
        ]
      };

      const result = testChatToResponseRoundTrip(
        originalChat,
        translatedResponse,
        backTranslatedChat
      );

      // Should pass because last message is compared, not full history
      expect(result.success).toBe(true);
    });
  });

  describe('testResponseToChatRoundTrip', () => {
    it('should pass round-trip with semantically equivalent requests', () => {
      const originalResponse = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.7,
        max_output_tokens: 100
      };

      const translatedChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100
      };

      const backTranslatedResponse = {
        model: 'gpt-4',
        input: 'Hello',
        temperature: 0.7,
        max_output_tokens: 100
      };

      const result = testResponseToChatRoundTrip(
        originalResponse,
        translatedChat,
        backTranslatedResponse
      );

      expect(result.success).toBe(true);
      expect(result.semanticEquivalence.model).toBe(true);
      expect(result.semanticEquivalence.content).toBe(true);
    });

    it('should fail when model differs', () => {
      const originalResponse = {
        model: 'gpt-4',
        input: 'Hello'
      };

      const translatedChat = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const backTranslatedResponse = {
        model: 'gpt-3.5-turbo',
        input: 'Hello'
      };

      const result = testResponseToChatRoundTrip(
        originalResponse,
        translatedChat,
        backTranslatedResponse
      );

      expect(result.success).toBe(false);
      expect(result.semanticEquivalence.model).toBe(false);
    });
  });

  describe('formatRoundTripResult', () => {
    it('should format passing result', () => {
      const result = {
        success: true,
        original: {},
        translated: {},
        backTranslated: {},
        differences: [],
        semanticEquivalence: {
          model: true,
          content: true,
          parameters: true
        }
      };

      const formatted = formatRoundTripResult(result);

      expect(formatted).toContain('✓ PASS');
      expect(formatted).toContain('✓');
    });

    it('should format failing result', () => {
      const result = {
        success: false,
        original: {},
        translated: {},
        backTranslated: {},
        differences: ['model: "gpt-4" !== "gpt-3.5-turbo"'],
        semanticEquivalence: {
          model: false,
          content: true,
          parameters: true
        }
      };

      const formatted = formatRoundTripResult(result);

      expect(formatted).toContain('✗ FAIL');
      expect(formatted).toContain('✗');
      expect(formatted).toContain('model: "gpt-4" !== "gpt-3.5-turbo"');
    });

    it('should include all differences in formatted output', () => {
      const result = {
        success: false,
        original: {},
        translated: {},
        backTranslated: {},
        differences: [
          'field1: value1 !== value2',
          'field2: value3 !== value4'
        ],
        semanticEquivalence: {
          model: false,
          content: false,
          parameters: true
        }
      };

      const formatted = formatRoundTripResult(result);

      expect(formatted).toContain('field1: value1 !== value2');
      expect(formatted).toContain('field2: value3 !== value4');
    });
  });
});

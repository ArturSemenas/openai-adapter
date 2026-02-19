import { describe, it, expect } from 'vitest';
import { validateJsonDepth } from '../../../src/validation/json-depth-validator.js';
import { ValidationError, VALIDATION_ERROR_TYPES } from '../../../src/types/validation-errors.js';

describe('validateJsonDepth', () => {
  const MAX_DEPTH = 5;

  describe('Valid shallow objects', () => {
    it('should pass for empty object', () => {
      expect(() => validateJsonDepth({}, MAX_DEPTH)).not.toThrow();
    });

    it('should pass for empty array', () => {
      expect(() => validateJsonDepth([], MAX_DEPTH)).not.toThrow();
    });

    it('should pass for primitive values', () => {
      expect(() => validateJsonDepth('string', MAX_DEPTH)).not.toThrow();
      expect(() => validateJsonDepth(42, MAX_DEPTH)).not.toThrow();
      expect(() => validateJsonDepth(true, MAX_DEPTH)).not.toThrow();
      expect(() => validateJsonDepth(null, MAX_DEPTH)).not.toThrow();
    });

    it('should pass for flat object', () => {
      const obj = {
        name: 'test',
        value: 42,
        active: true
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });

    it('should pass for flat array', () => {
      const arr = [1, 2, 3, 'test', true];
      expect(() => validateJsonDepth(arr, MAX_DEPTH)).not.toThrow();
    });

    it('should pass for object with array property', () => {
      const obj = {
        items: [1, 2, 3]
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });

    it('should pass for array with object elements', () => {
      const arr = [
        { id: 1 },
        { id: 2 }
      ];
      expect(() => validateJsonDepth(arr, MAX_DEPTH)).not.toThrow();
    });
  });

  describe('Valid nested objects at max depth', () => {
    it('should pass for object nested 5 levels deep', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'value'
              }
            }
          }
        }
      };
      expect(() => validateJsonDepth(obj, 5)).not.toThrow();
    });

    it('should pass for array nested 5 levels deep', () => {
      const arr: unknown[] = [[[[[1]]]]];
      expect(() => validateJsonDepth(arr, 5)).not.toThrow();
    });

    it('should pass for mixed nesting at exactly max depth', () => {
      // This structure has both arrays and objects
      // Depth is 7: object -> array -> object -> array -> object -> array -> object
      const obj = {
        key: [
          {
            item: [
              {
                value: [
                  {
                    deep: 'here'
                  }
                ]
              }
            ]
          }
        ]
      };
      expect(() => validateJsonDepth(obj, 7)).not.toThrow();
    });
  });

  describe('Invalid deeply nested objects', () => {
    it('should reject object nested 6 levels deep', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'too deep'
                }
              }
            }
          }
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).toThrow(ValidationError);
    });

    it('should reject array nested 6 levels deep', () => {
      const arr: unknown[] = [[[[[[1]]]]]];
      expect(() => validateJsonDepth(arr, MAX_DEPTH)).toThrow(ValidationError);
    });

    it('should reject mixed nesting exceeding max depth', () => {
      const obj = {
        key: [
          {
            item: [
              {
                value: [
                  {
                    deep: {
                      tooDeep: 'here'
                    }
                  }
                ]
              }
            ]
          }
        ]
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).toThrow(ValidationError);
    });

    it('should reject very deep nesting', () => {
      let obj: unknown = 'value';
      for (let i = 0; i < 20; i++) {
        obj = { nested: obj };
      }
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).toThrow(ValidationError);
    });
  });

  describe('Error details', () => {
    it('should provide correct error type', () => {
      const obj = { a: { b: { c: { d: { e: { f: {} } } } } } };
      try {
        validateJsonDepth(obj, MAX_DEPTH);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).type).toBe(
          VALIDATION_ERROR_TYPES.JSON_DEPTH_EXCEEDED
        );
      }
    });

    it('should include max depth in error message', () => {
      const obj = { a: { b: { c: { d: { e: { f: {} } } } } } };
      try {
        validateJsonDepth(obj, 4);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).message).toContain('4');
      }
    });

    it('should have source property set to adapter_error', () => {
      const obj = { a: { b: { c: { d: { e: { f: {} } } } } } };
      try {
        validateJsonDepth(obj, MAX_DEPTH);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).source).toBe('adapter_error');
      }
    });
  });

  describe('Complex nested structures', () => {
    it('should handle object with multiple properties at same level', () => {
      const obj = {
        user: {
          name: 'John',
          email: 'john@example.com'
        },
        settings: {
          theme: 'dark',
          notifications: true
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });

    it('should handle arrays with multiple objects', () => {
      const arr = [
        { id: 1, data: { nested: 'value' } },
        { id: 2, data: { nested: 'value' } },
        { id: 3, data: { nested: 'value' } }
      ];
      expect(() => validateJsonDepth(arr, MAX_DEPTH)).not.toThrow();
    });

    it('should detect depth violation in any branch', () => {
      const obj = {
        shallow: { a: 1 },
        deep: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    level6: 'too deep'
                  }
                }
              }
            }
          }
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).toThrow();
    });

    it('should handle objects with null values', () => {
      const obj = {
        a: {
          b: {
            c: {
              d: {
                e: null
              }
            }
          }
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });

    it('should handle objects with array of nulls', () => {
      const obj = {
        items: [null, null, { deep: { nested: null } }]
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });
  });

  describe('Real-world API payloads', () => {
    it('should pass typical chat completion request', () => {
      const payload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      };
      expect(() => validateJsonDepth(payload, MAX_DEPTH)).not.toThrow();
    });

    it('should pass chat with function tools', () => {
      // This has depth 7 in the tools branch
      const payload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };
      // Max depth is 7: root -> tools array -> tool object -> function object -> parameters object -> properties object -> location object
      expect(() => validateJsonDepth(payload, 7)).not.toThrow();
    });
  });

  describe('Different max depth settings', () => {
    it('should work with max depth of 1', () => {
      expect(() => validateJsonDepth({}, 1)).not.toThrow();
      expect(() => validateJsonDepth({ a: {} }, 1)).toThrow();
    });

    it('should work with max depth of 100', () => {
      const obj = { a: 1 };
      expect(() => validateJsonDepth(obj, 100)).not.toThrow();
    });

    it('should enforce different limits correctly', () => {
      const obj = {
        a: {
          b: {
            c: { value: 1 }
          }
        }
      };
      // This object has depth 4
      expect(() => validateJsonDepth(obj, 4)).not.toThrow();
      expect(() => validateJsonDepth(obj, 3)).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle deeply nested arrays with sparse elements', () => {
      // eslint-disable-next-line no-sparse-arrays
      const arr = [, , { a: { b: { c: { d: 'deep' } } } }, ,] as unknown[];
      expect(() => validateJsonDepth(arr, MAX_DEPTH)).not.toThrow();
    });

    it('should handle circular-like structures (no actual circular refs in JSON)', () => {
      const obj = {
        a: {
          b: {
            c: {
              parent: { reference: 'similar' }
            }
          }
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });

    it('should handle unicode property names', () => {
      const obj = {
        '中文': {
          'العربية': {
            'Ελληνικά': 'value'
          }
        }
      };
      expect(() => validateJsonDepth(obj, MAX_DEPTH)).not.toThrow();
    });
  });
});

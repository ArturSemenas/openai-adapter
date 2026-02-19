/**
 * Round-trip testing utility
 * Validates functional equivalence: request -> translate -> translate back -> compare
 */

import type { RoundTripTestResult } from '../types.js';

/**
 * Compare two objects for semantic equivalence
 * Used in round-trip tests to validate that translation preserves intent
 */
interface SemanticEquivalenceResult {
  model: boolean;
  content: boolean;
  parameters: boolean;
  differences: string[];
}

/**
 * Extract core fields for comparison
 * Handles differences in field names between formats
 */
interface ComparisonFields {
  model: string | undefined;
  content: string | undefined;
  parameters: Record<string, unknown>;
}

/**
 * Extract comparable fields from Chat Completions format
 */
function extractChatFields(obj: unknown): ComparisonFields {
  if (typeof obj !== 'object' || obj === null) {
    return { model: undefined, content: undefined, parameters: {} };
  }

  const chat = obj as Record<string, unknown>;
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const lastMessage = messages[messages.length - 1] as Record<string, unknown> | undefined;
  const content = typeof lastMessage?.content === 'string' ? lastMessage.content : undefined;

  return {
    model: typeof chat.model === 'string' ? chat.model : undefined,
    content,
    parameters: {
      temperature: chat.temperature,
      max_tokens: chat.max_tokens ?? chat.max_completion_tokens,
      top_p: chat.top_p,
      stream: chat.stream,
      tools: chat.tools,
      tool_choice: chat.tool_choice
    }
  };
}

/**
 * Extract comparable fields from Response API format
 */
function extractResponseFields(obj: unknown): ComparisonFields {
  if (typeof obj !== 'object' || obj === null) {
    return { model: undefined, content: undefined, parameters: {} };
  }

  const response = obj as Record<string, unknown>;
  const content = typeof response.input === 'string' ? response.input : undefined;

  return {
    model: typeof response.model === 'string' ? response.model : undefined,
    content,
    parameters: {
      temperature: response.temperature,
      max_tokens: response.max_output_tokens,
      top_p: response.top_p,
      stream: response.stream,
      tools: response.tools,
      tool_choice: response.tool_choice
    }
  };
}

/**
 * Compare two field sets for semantic equivalence
 */
function compareSemanticEquivalence(
  original: ComparisonFields,
  backTranslated: ComparisonFields
): SemanticEquivalenceResult {
  const differences: string[] = [];

  // Model must match exactly
  const modelMatch = original.model === backTranslated.model;
  if (!modelMatch) {
    differences.push(
      `model: "${original.model}" !== "${backTranslated.model}"`
    );
  }

  // Content should match (after format changes)
  const contentMatch = original.content === backTranslated.content;
  if (!contentMatch) {
    differences.push(
      `content: "${original.content}" !== "${backTranslated.content}"`
    );
  }

  // Check key parameters
  const originalParams = original.parameters;
  const backParams = backTranslated.parameters;
  const parametersMatch =
    originalParams.temperature === backParams.temperature &&
    originalParams.max_tokens === backParams.max_tokens &&
    originalParams.top_p === backParams.top_p &&
    originalParams.stream === backParams.stream;

  if (!parametersMatch) {
    const diffs = [];
    if (originalParams.temperature !== backParams.temperature) {
      diffs.push(`temperature: ${originalParams.temperature} !== ${backParams.temperature}`);
    }
    if (originalParams.max_tokens !== backParams.max_tokens) {
      diffs.push(`max_tokens: ${originalParams.max_tokens} !== ${backParams.max_tokens}`);
    }
    if (originalParams.top_p !== backParams.top_p) {
      diffs.push(`top_p: ${originalParams.top_p} !== ${backParams.top_p}`);
    }
    if (originalParams.stream !== backParams.stream) {
      diffs.push(`stream: ${originalParams.stream} !== ${backParams.stream}`);
    }
    differences.push(...diffs);
  }

  return {
    model: modelMatch,
    content: contentMatch,
    parameters: parametersMatch,
    differences
  };
}

/**
 * Test round-trip translation: Chat -> Response -> Chat
 * @param originalChat Original Chat Completions request
 * @param translatedResponse Response API request (result of Chat->Response translation)
 * @param backTranslatedChat Back-translated Chat Completions request (result of Response->Chat translation)
 * @returns RoundTripTestResult with comparison details
 */
export function testChatToResponseRoundTrip(
  originalChat: unknown,
  translatedResponse: unknown,
  backTranslatedChat: unknown
): RoundTripTestResult {
  try {
    const originalFields = extractChatFields(originalChat);
    const backTranslatedFields = extractChatFields(backTranslatedChat);

    const equivalence = compareSemanticEquivalence(originalFields, backTranslatedFields);

    const success =
      equivalence.model &&
      equivalence.content &&
      equivalence.parameters &&
      equivalence.differences.length === 0;

    return {
      success,
      original: originalChat,
      translated: translatedResponse,
      backTranslated: backTranslatedChat,
      differences: equivalence.differences,
      semanticEquivalence: {
        model: equivalence.model,
        content: equivalence.content,
        parameters: equivalence.parameters
      }
    };
  } catch (error) {
    return {
      success: false,
      original: originalChat,
      translated: translatedResponse,
      backTranslated: backTranslatedChat,
      differences: [
        `Round-trip test failed with error: ${error instanceof Error ? error.message : String(error)}`
      ],
      semanticEquivalence: {
        model: false,
        content: false,
        parameters: false
      }
    };
  }
}

/**
 * Test round-trip translation: Response -> Chat -> Response
 * @param originalResponse Original Response API request
 * @param translatedChat Chat Completions request (result of Response->Chat translation)
 * @param backTranslatedResponse Back-translated Response API request (result of Chat->Response translation)
 * @returns RoundTripTestResult with comparison details
 */
export function testResponseToChatRoundTrip(
  originalResponse: unknown,
  translatedChat: unknown,
  backTranslatedResponse: unknown
): RoundTripTestResult {
  try {
    const originalFields = extractResponseFields(originalResponse);
    const backTranslatedFields = extractResponseFields(backTranslatedResponse);

    const equivalence = compareSemanticEquivalence(originalFields, backTranslatedFields);

    const success =
      equivalence.model &&
      equivalence.content &&
      equivalence.parameters &&
      equivalence.differences.length === 0;

    return {
      success,
      original: originalResponse,
      translated: translatedChat,
      backTranslated: backTranslatedResponse,
      differences: equivalence.differences,
      semanticEquivalence: {
        model: equivalence.model,
        content: equivalence.content,
        parameters: equivalence.parameters
      }
    };
  } catch (error) {
    return {
      success: false,
      original: originalResponse,
      translated: translatedChat,
      backTranslated: backTranslatedResponse,
      differences: [
        `Round-trip test failed with error: ${error instanceof Error ? error.message : String(error)}`
      ],
      semanticEquivalence: {
        model: false,
        content: false,
        parameters: false
      }
    };
  }
}

/**
 * Format round-trip test result for display
 */
export function formatRoundTripResult(result: RoundTripTestResult): string {
  const status = result.success ? '✓ PASS' : '✗ FAIL';
  const equivalence = result.semanticEquivalence;

  const lines = [
    status,
    `  Model: ${equivalence.model ? '✓' : '✗'}`,
    `  Content: ${equivalence.content ? '✓' : '✗'}`,
    `  Parameters: ${equivalence.parameters ? '✓' : '✗'}`
  ];

  if (result.differences.length > 0) {
    lines.push('  Differences:');
    result.differences.forEach((diff) => {
      lines.push(`    - ${diff}`);
    });
  }

  return lines.join('\n');
}

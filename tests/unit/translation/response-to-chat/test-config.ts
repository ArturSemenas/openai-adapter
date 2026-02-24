/**
 * Property-based test configuration for Response API to Chat Completions translation
 * 
 * This module provides configuration settings for fast-check property-based tests,
 * including minimum iteration counts and test parameters.
 */

/**
 * Property-based test configuration
 * 
 * Per requirements 6.1 and 6.2, property tests must run a minimum of 100 iterations
 * to ensure comprehensive coverage across the input space.
 */
export const PROPERTY_TEST_CONFIG = {
  /**
   * Minimum number of iterations for each property test
   * 
   * This ensures sufficient coverage of the input space to detect edge cases
   * and validate universal properties across diverse inputs.
   */
  numRuns: 100,
  
  /**
   * Seed for reproducible test runs (optional)
   * 
   * When set, fast-check will use this seed for deterministic random generation,
   * making test failures reproducible.
   */
  seed: undefined as number | undefined,
  
  /**
   * Path for shrinking (optional)
   * 
   * When a property test fails, fast-check will attempt to find the smallest
   * failing example through shrinking. This path controls the shrinking behavior.
   */
  path: undefined as string | undefined,
  
  /**
   * Verbose mode (optional)
   * 
   * When enabled, fast-check will output detailed information about test execution,
   * including generated values and shrinking steps.
   */
  verbose: false,
  
  /**
   * Maximum number of shrinking iterations
   * 
   * Controls how many shrinking steps fast-check will attempt when a test fails.
   */
  maxShrinkIterations: 1000
} as const;

/**
 * Test timeout configuration (milliseconds)
 * 
 * Property-based tests may take longer than unit tests due to multiple iterations.
 * These timeouts ensure tests don't hang indefinitely.
 */
export const TEST_TIMEOUTS = {
  /**
   * Timeout for individual property tests
   */
  propertyTest: 30000, // 30 seconds
  
  /**
   * Timeout for unit tests
   */
  unitTest: 5000, // 5 seconds
  
  /**
   * Timeout for integration tests
   */
  integrationTest: 60000 // 60 seconds
} as const;

/**
 * Test data constraints
 * 
 * These constraints define the boundaries for generated test data,
 * ensuring realistic and valid inputs.
 */
export const TEST_DATA_CONSTRAINTS = {
  /**
   * String length constraints
   */
  strings: {
    minLength: 1,
    maxLength: 1000,
    modelMaxLength: 100,
    instructionsMaxLength: 500
  },
  
  /**
   * Array length constraints
   */
  arrays: {
    minMessages: 1,
    maxMessages: 10,
    minTools: 1,
    maxTools: 5
  },
  
  /**
   * Numeric parameter constraints
   */
  parameters: {
    temperature: { min: 0, max: 2 },
    topP: { min: 0, max: 1 },
    maxTokens: { min: 1, max: 4096 }
  }
} as const;

/**
 * Helper function to create property test options with default configuration
 * 
 * @param overrides - Optional overrides for default configuration
 * @returns Property test configuration object
 */
export function createPropertyTestConfig(
  overrides?: Partial<typeof PROPERTY_TEST_CONFIG>
): typeof PROPERTY_TEST_CONFIG {
  return {
    ...PROPERTY_TEST_CONFIG,
    ...overrides
  };
}

/**
 * Helper function to get test timeout based on test type
 * 
 * @param testType - Type of test (property, unit, integration)
 * @returns Timeout in milliseconds
 */
export function getTestTimeout(
  testType: 'property' | 'unit' | 'integration'
): number {
  switch (testType) {
    case 'property':
      return TEST_TIMEOUTS.propertyTest;
    case 'unit':
      return TEST_TIMEOUTS.unitTest;
    case 'integration':
      return TEST_TIMEOUTS.integrationTest;
    default:
      return TEST_TIMEOUTS.unitTest;
  }
}

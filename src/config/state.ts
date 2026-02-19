/**
 * Global configuration state holder
 * Tracks whether the adapter configuration is valid and ready for operation
 */

export interface ConfigState {
  isValid: boolean;
  config?: Record<string, unknown>;
  error?: Error;
}

let configState: ConfigState = {
  isValid: false
};

/**
 * Get the current configuration state
 * Used by readiness handler to determine if adapter is ready
 */
export function getConfigState(): ConfigState {
  return configState;
}

/**
 * Set the configuration state to valid
 * Called by startup flow after successful config validation
 */
export function setConfigValid(config: Record<string, unknown>): void {
  configState = {
    isValid: true,
    config
  };
}

/**
 * Set the configuration state to invalid
 * Called by startup flow if config validation fails
 */
export function setConfigInvalid(error: Error): void {
  configState = {
    isValid: false,
    error
  };
}

/**
 * Reset configuration state
 * Primarily for testing purposes
 */
export function resetConfigState(): void {
  configState = {
    isValid: false
  };
}

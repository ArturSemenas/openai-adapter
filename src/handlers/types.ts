/**
 * Health and readiness endpoint response types
 * Used for operational probes in Kubernetes and orchestration platforms
 */

export interface HealthResponse {
  status: 'ok';
}

export interface ReadinessSuccessResponse {
  status: 'ready';
  checks: {
    config: 'ok';
  };
}

export interface ReadinessFailureResponse {
  status: 'not_ready';
  checks: {
    config: 'failed';
  };
  message: string;
}

export type ReadinessResponse = ReadinessSuccessResponse | ReadinessFailureResponse;

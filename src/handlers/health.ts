/**
 * Health and readiness endpoint handlers
 * Implement Kubernetes liveness and readiness probe patterns
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { getConfigState } from '../config/state.js';
import type { HealthResponse, ReadinessResponse } from './types.js';

/**
 * Health handler - Kubernetes liveness probe
 * 
 * Answers: "Is the process alive?"
 * - Always returns 200 if HTTP server is responding
 * - No configuration or dependency checks
 * - Ultra-lightweight, can be called frequently by orchestration platforms
 * 
 * AC-1: Health Endpoint (`/health`) - Process Alive Check
 */
export async function getHealth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<HealthResponse> {
  reply.type('application/json');
  reply.code(200);
  return { status: 'ok' };
}

/**
 * Readiness handler - Kubernetes readiness probe
 * 
 * Answers: "Can this instance accept traffic?"
 * - Returns 200 when all checks pass (configuration valid)
 * - Returns 503 when checks fail (configuration invalid)
 * - Used to control load balancer routing and service mesh traffic
 * - Future: storage connectivity checks will be added in Epic 4
 * 
 * AC-2: Readiness Endpoint (`/ready`) - All Checks Pass
 * AC-3: Readiness Endpoint (`/ready`) - Configuration Invalid
 */
export async function getReadiness(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ReadinessResponse> {
  reply.type('application/json');

  const configState = getConfigState();

  if (configState.isValid) {
    reply.code(200);
    return {
      status: 'ready',
      checks: {
        config: 'ok'
      }
    };
  }

  reply.code(503);
  return {
    status: 'not_ready',
    checks: {
      config: 'failed'
    },
    message: 'Configuration validation failed'
  };
}

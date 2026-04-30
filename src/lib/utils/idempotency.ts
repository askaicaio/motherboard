import { nanoid } from "nanoid";

/**
 * Generate an idempotency key for an onboarding request.
 */
export function generateRequestIdempotencyKey(): string {
  return `onb_${nanoid(16)}`;
}

/**
 * Generate an idempotency key for a provisioning step.
 */
export function generateStepIdempotencyKey(
  requestId: string,
  toolKey: string,
  attemptNumber: number
): string {
  return `step_${requestId}_${toolKey}_${attemptNumber}`;
}

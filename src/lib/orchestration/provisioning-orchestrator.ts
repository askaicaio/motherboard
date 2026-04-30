// =============================================================
// Orchestration Layer — Provisioning Orchestrator
// =============================================================
// Coordinates the execution of provisioning steps against n8n,
// handles retry queues, processes callbacks, and manages the
// provisioning job lifecycle.
// =============================================================

import { db } from "@/lib/db";
import {
  provisioningSteps,
  provisioningJobs,
  onboardingRequests,
  manualTasks,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { triggerN8nWebhook } from "@/lib/n8n/client";
import { getProvider } from "@/lib/providers/registry";
import { audit } from "@/lib/audit/logger";
import { refreshRequestStatus } from "@/lib/business/onboarding-service";
import { sendNotification } from "@/lib/notifications/notification-service";
import type { ProvisioningResult } from "@/lib/providers/types";

// ---- Types ----

export interface ProvisioningJobResult {
  jobId: string;
  stepsTriggered: number;
  stepsSkipped: number;
  errors: Array<{ toolKey: string; error: string }>;
}

// ---- Orchestration Functions ----

/**
 * Start provisioning for an approved request.
 * Creates a provisioning job, then triggers each pending step via n8n.
 */
export async function startProvisioning(
  requestId: string,
  actorId: string,
  actorEmail: string
): Promise<ProvisioningJobResult> {
  const request = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "approved" && request.status !== "partially_provisioned") {
    throw new Error(
      `Cannot start provisioning for request in "${request.status}" state`
    );
  }

  // Create a provisioning job to track this batch
  const [job] = await db
    .insert(provisioningJobs)
    .values({
      requestId,
      status: "running",
      jobType: "onboarding",
      triggeredBy: actorId,
      startedAt: new Date(),
    })
    .returning();

  // Update request status
  await db
    .update(onboardingRequests)
    .set({
      status: "provisioning_in_progress",
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, requestId));

  await audit({
    action: "provisioning_started",
    requestId,
    actorId,
    actorEmail,
    details: { jobId: job.id },
  });

  // Get all pending steps, ordered by execution priority
  const steps = await db.query.provisioningSteps.findMany({
    where: and(
      eq(provisioningSteps.requestId, requestId),
      inArray(provisioningSteps.status, ["pending", "failed"])
    ),
  });

  const sorted = steps.sort((a, b) => a.executionOrder - b.executionOrder);

  let stepsTriggered = 0;
  let stepsSkipped = 0;
  const errors: Array<{ toolKey: string; error: string }> = [];

  for (const step of sorted) {
    const provider = getProvider(step.toolKey);
    if (!provider) {
      // No provider — mark as manual_required
      await db
        .update(provisioningSteps)
        .set({ status: "manual_required", updatedAt: new Date() })
        .where(eq(provisioningSteps.id, step.id));
      stepsSkipped++;
      continue;
    }

    // Skip if max attempts exceeded
    if (step.attemptCount >= step.maxAttempts) {
      stepsSkipped++;
      continue;
    }

    try {
      // Build and trigger n8n webhook
      const payload = provider.buildN8nPayload({
        requestId: request.id,
        stepId: step.id,
        idempotencyKey: step.idempotencyKey,
        employee: {
          name: request.employeeName,
          email: request.employeeEmail,
          personalEmail: request.personalEmail || undefined,
          jobTitle: request.jobTitle,
          department: request.department,
          division: request.division,
          managerEmail: request.managerEmail || undefined,
          startDate: request.startDate,
        },
        config: step.config as Record<string, unknown>,
        attemptNumber: step.attemptCount + 1,
      });

      await triggerN8nWebhook(payload);

      // Mark step as in_progress
      await db
        .update(provisioningSteps)
        .set({
          status: "in_progress",
          attemptCount: step.attemptCount + 1,
          lastAttemptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(provisioningSteps.id, step.id));

      await audit({
        action: "provisioning_step_started",
        requestId,
        actorId,
        actorEmail,
        details: { stepId: step.id, toolKey: step.toolKey, attempt: step.attemptCount + 1 },
      });

      stepsTriggered++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push({ toolKey: step.toolKey, error: errorMsg });

      await db
        .update(provisioningSteps)
        .set({
          status: "failed",
          errorMessage: `Trigger failed: ${errorMsg}`,
          attemptCount: step.attemptCount + 1,
          lastAttemptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(provisioningSteps.id, step.id));

      await audit({
        action: "provisioning_step_failed",
        requestId,
        actorId,
        actorEmail,
        details: { stepId: step.id, toolKey: step.toolKey, error: errorMsg },
      });
    }
  }

  // Update job status
  const jobStatus =
    errors.length === 0
      ? stepsTriggered > 0
        ? "running"
        : "completed"
      : stepsTriggered > 0
        ? "running"
        : "failed";

  await db
    .update(provisioningJobs)
    .set({
      status: jobStatus,
      ...(jobStatus !== "running" ? { completedAt: new Date() } : {}),
    })
    .where(eq(provisioningJobs.id, job.id));

  return {
    jobId: job.id,
    stepsTriggered,
    stepsSkipped,
    errors,
  };
}

/**
 * Process an n8n callback for a provisioning step.
 * Updates step status, creates manual tasks if needed, refreshes request status.
 */
export async function processCallback(
  stepId: string,
  callbackData: unknown
): Promise<{ step: typeof provisioningSteps.$inferSelect; result: ProvisioningResult }> {
  const step = await db.query.provisioningSteps.findFirst({
    where: eq(provisioningSteps.id, stepId),
  });

  if (!step) throw new Error(`Step ${stepId} not found`);

  const provider = getProvider(step.toolKey);
  if (!provider) throw new Error(`No provider for ${step.toolKey}`);

  const result = provider.parseN8nCallback(callbackData);

  // Update step
  const newStatus = result.success
    ? "success"
    : result.requiresManualAction
      ? "manual_required"
      : "failed";

  await db
    .update(provisioningSteps)
    .set({
      status: newStatus,
      resultData: result.data || null,
      errorMessage: result.errorMessage || null,
      n8nExecutionId: result.n8nExecutionId || null,
      updatedAt: new Date(),
    })
    .where(eq(provisioningSteps.id, step.id));

  // Audit log
  await audit({
    action: result.success ? "provisioning_step_completed" : "provisioning_step_failed",
    requestId: step.requestId,
    details: {
      stepId: step.id,
      toolKey: step.toolKey,
      status: newStatus,
      n8nExecutionId: result.n8nExecutionId,
    },
  });

  // Create manual task if needed
  if (result.requiresManualAction) {
    await db.insert(manualTasks).values({
      requestId: step.requestId,
      stepId: step.id,
      title: `Manual action required: ${provider.displayName}`,
      description:
        result.manualActionDescription ||
        `The ${provider.displayName} provisioning step requires manual completion.`,
      toolKey: step.toolKey,
      status: "pending",
    });

    await audit({
      action: "manual_task_created",
      requestId: step.requestId,
      details: {
        toolKey: step.toolKey,
        description: result.manualActionDescription,
      },
    });
  }

  // Notify relevant admins
  if (!result.success) {
    await sendNotification({
      type: result.requiresManualAction
        ? "manual_task_assigned"
        : "step_retry_needed",
      title: result.requiresManualAction
        ? `Manual action needed: ${provider.displayName}`
        : `Provisioning failed: ${provider.displayName}`,
      message: result.errorMessage ||
        result.manualActionDescription ||
        `Step "${provider.displayName}" needs attention for request ${step.requestId}`,
      relatedRequestId: step.requestId,
    });
  }

  // Refresh the parent request's status
  const updatedStep = await db.query.provisioningSteps.findFirst({
    where: eq(provisioningSteps.id, step.id),
  });

  await refreshRequestStatus(step.requestId);

  return { step: updatedStep!, result };
}

/**
 * Retry failed steps for a request.
 * Only retries steps that haven't exceeded max attempts and support retry.
 */
export async function retryFailedSteps(
  requestId: string,
  actorId: string,
  actorEmail: string,
  specificStepIds?: string[]
): Promise<ProvisioningJobResult> {
  // Get failed/retryable steps
  const failedSteps = await db.query.provisioningSteps.findMany({
    where: and(
      eq(provisioningSteps.requestId, requestId),
      eq(provisioningSteps.status, "failed")
    ),
  });

  const retryable = failedSteps.filter((step) => {
    if (specificStepIds && !specificStepIds.includes(step.id)) return false;
    if (step.attemptCount >= step.maxAttempts) return false;
    const provider = getProvider(step.toolKey);
    return provider?.supportsRetry ?? false;
  });

  if (retryable.length === 0) {
    return { jobId: "", stepsTriggered: 0, stepsSkipped: 0, errors: [] };
  }

  // Reset failed steps to pending for re-trigger
  for (const step of retryable) {
    await db
      .update(provisioningSteps)
      .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
      .where(eq(provisioningSteps.id, step.id));
  }

  await audit({
    action: "provisioning_retried",
    requestId,
    actorId,
    actorEmail,
    details: { retryCount: retryable.length, stepIds: retryable.map((s) => s.id) },
  });

  // Re-run provisioning (will only pick up pending/failed steps)
  return startProvisioning(requestId, actorId, actorEmail);
}

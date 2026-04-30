// =============================================================
// Business Layer — Offboarding Service (Future-Ready)
// =============================================================
// Schema and interfaces are in place for deprovisioning workflows.
// Implements the service interface so offboarding can be added
// incrementally per-tool without restructuring.
// =============================================================

import { db } from "@/lib/db";
import {
  onboardingRequests,
  provisioningSteps,
  provisioningJobs,
  manualTasks,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";
import { generateRequestIdempotencyKey } from "@/lib/utils/idempotency";
import { getProvider } from "@/lib/providers/registry";

// ---- Types ----

export interface OffboardingPlan {
  requestId: string;
  toolsToDeprovision: string[];
  manualStepsRequired: string[];
  estimatedDuration: string;
}

export interface OffboardingResult {
  jobId: string;
  stepsCreated: number;
  manualTasksCreated: number;
}

// ---- Service Functions ----

/**
 * Generate an offboarding plan for a completed onboarding request.
 * Returns the list of tools to deprovision and any manual steps needed.
 */
export async function generateOffboardingPlan(
  requestId: string
): Promise<OffboardingPlan> {
  const request = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");

  const steps = await db.query.provisioningSteps.findMany({
    where: eq(provisioningSteps.requestId, requestId),
  });

  const successfulTools = steps
    .filter((s) => s.status === "success" || s.status === "manual_required")
    .map((s) => s.toolKey);

  const manualSteps: string[] = [];

  for (const toolKey of successfulTools) {
    const provider = getProvider(toolKey);
    if (!provider) {
      manualSteps.push(`Manually revoke ${toolKey} access`);
    }
    // TODO: Check if provider supports deprovisioning
    // For now, all offboarding is manual or via n8n workflows
  }

  // 1Password always requires manual vault removal
  if (successfulTools.includes("onepassword")) {
    manualSteps.push("Remove user from all 1Password vaults and revoke invite");
  }

  // Fathom is a shared account - just need to change password if sole user
  if ((request.requestedTools as string[]).includes("fathom")) {
    manualSteps.push("Verify Fathom shared account password hasn't been changed");
  }

  return {
    requestId,
    toolsToDeprovision: successfulTools,
    manualStepsRequired: manualSteps,
    estimatedDuration: `${Math.max(successfulTools.length * 5, 15)} minutes`,
  };
}

/**
 * Start the offboarding process for a request.
 * Creates an offboarding job and manual tasks for each tool.
 */
export async function startOffboarding(
  requestId: string,
  actorId: string,
  actorEmail: string,
  notes?: string
): Promise<OffboardingResult> {
  const plan = await generateOffboardingPlan(requestId);

  // Create offboarding job
  const [job] = await db
    .insert(provisioningJobs)
    .values({
      requestId,
      status: "running",
      jobType: "offboarding",
      triggeredBy: actorId,
      startedAt: new Date(),
      metadata: { plan },
    })
    .returning();

  // Update request status
  await db
    .update(onboardingRequests)
    .set({
      status: "offboarded",
      offboardedAt: new Date(),
      offboardedBy: actorId,
      offboardingNotes: notes || null,
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, requestId));

  // Create manual tasks for each deprovision step
  const taskValues = plan.toolsToDeprovision.map((toolKey) => ({
    requestId,
    title: `Offboard: Revoke ${toolKey} access`,
    description: `Remove user access from ${toolKey}. ${plan.manualStepsRequired.find((s) => s.includes(toolKey)) || "Follow standard deprovision procedure."}`,
    toolKey,
    status: "pending" as const,
  }));

  // Add any extra manual steps
  for (const step of plan.manualStepsRequired) {
    const alreadyCovered = plan.toolsToDeprovision.some((t) =>
      step.toLowerCase().includes(t.toLowerCase())
    );
    if (!alreadyCovered) {
      taskValues.push({
        requestId,
        title: `Offboard: ${step}`,
        description: step,
        toolKey: null as unknown as string,
        status: "pending" as const,
      });
    }
  }

  let manualTasksCreated = 0;
  if (taskValues.length > 0) {
    await db.insert(manualTasks).values(taskValues);
    manualTasksCreated = taskValues.length;
  }

  // Complete the job (offboarding is manual for now)
  await db
    .update(provisioningJobs)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(provisioningJobs.id, job.id));

  await audit({
    action: "offboarding_started",
    requestId,
    actorId,
    actorEmail,
    details: {
      jobId: job.id,
      toolsToDeprovision: plan.toolsToDeprovision,
      manualTasksCreated,
      notes,
    },
  });

  return {
    jobId: job.id,
    stepsCreated: 0, // No automated steps yet
    manualTasksCreated,
  };
}

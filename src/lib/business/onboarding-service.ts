// =============================================================
// Business Layer — Onboarding Service
// =============================================================
// Centralizes all onboarding business logic: validation, approval
// workflows, provisioning plan generation, and status transitions.
// This keeps API routes thin and business rules testable.
// =============================================================

import { db } from "@/lib/db";
import {
  onboardingRequests,
  provisioningSteps,
  accessProfiles,
  manualTasks,
  provisioningJobs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { evaluateRules } from "@/lib/rules/engine";
import { generateRequestIdempotencyKey, generateStepIdempotencyKey } from "@/lib/utils/idempotency";
import { resolveRequestStatus } from "@/lib/utils/status-resolver";
import { getProvider, getAllProviders } from "@/lib/providers/registry";
import { audit } from "@/lib/audit/logger";
import type { ProvisioningConfig } from "@/lib/providers/types";
import type { OnboardingStatus, ToolKey } from "@/types";

// ---- Types ----

export interface CreateRequestInput {
  employeeName: string;
  preferredName?: string;
  employeeEmail: string;
  personalEmail?: string;
  phone?: string;
  jobTitle: string;
  department: string;
  division: "b2c" | "b2b" | "sales";
  managerName?: string;
  managerEmail?: string;
  startDate: string;
  timezone?: string;
  employmentType?: string;
  location?: string;
  onboardingOwner?: string;
  workEmailPrefix?: string;
  notes?: string;
  requestedTools: string[];
  slackChannels?: string[];
  googleGroups?: string[];
  clickupAccessType?: string;
  onepasswordVaultProfile?: string;
  manualOverrideNotes?: string;
  accessProfileId?: string;
}

export interface ApprovalResult {
  requestId: string;
  stepsCreated: number;
  manualTasksCreated: number;
  toolConfigs: Record<string, ProvisioningConfig>;
}

// ---- Service Functions ----

/**
 * Submit a new onboarding request. Sets status to pending_approval.
 */
export async function createOnboardingRequest(
  input: CreateRequestInput,
  actorId: string,
  actorEmail: string
) {
  const idempotencyKey = generateRequestIdempotencyKey();

  const [request] = await db
    .insert(onboardingRequests)
    .values({
      ...input,
      status: "pending_approval",
      idempotencyKey,
      createdBy: actorId,
      requestedTools: input.requestedTools,
      slackChannels: input.slackChannels || [],
      googleGroups: input.googleGroups || [],
    })
    .returning();

  await audit({
    action: "request_created",
    requestId: request.id,
    actorId,
    actorEmail,
    details: {
      employeeName: input.employeeName,
      department: input.department,
      toolCount: input.requestedTools.length,
    },
  });

  return request;
}

/**
 * Approve a request: evaluates rules, merges access profile configs,
 * creates provisioning steps, and generates manual tasks for non-automatable tools.
 */
export async function approveRequest(
  requestId: string,
  actorId: string,
  actorEmail: string
): Promise<ApprovalResult> {
  const request = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending_approval") {
    throw new Error(`Cannot approve request in ${request.status} state`);
  }

  // 1. Get access profile config if one is linked
  let profileConfigs: Record<string, ProvisioningConfig> = {};
  if (request.accessProfileId) {
    const profile = await db.query.accessProfiles.findFirst({
      where: eq(accessProfiles.id, request.accessProfileId),
    });
    if (profile) {
      profileConfigs = (profile.toolConfigs as Record<string, ProvisioningConfig>) || {};
    }
  }

  // 2. Evaluate rules engine for department/division/role matches
  const ruleConfigs = await evaluateRules({
    department: request.department,
    division: request.division,
    jobTitle: request.jobTitle,
  });

  // 3. Merge: access profile < rules engine < manual form overrides
  const requestedTools = request.requestedTools as string[];
  const finalConfigs: Record<string, ProvisioningConfig> = {};

  for (const toolKey of requestedTools) {
    const base = profileConfigs[toolKey] || {};
    const ruleConfig = ruleConfigs.get(toolKey) || {};
    const formOverrides = buildFormOverrides(request, toolKey);

    finalConfigs[toolKey] = mergeLayeredConfigs(base, ruleConfig, formOverrides);
  }

  // 4. Create provisioning steps
  const providers = getAllProviders();
  const stepsToInsert = [];
  const manualTasksToInsert = [];
  let stepsCreated = 0;
  let manualTasksCreated = 0;

  for (const toolKey of requestedTools) {
    const provider = getProvider(toolKey);
    const config = finalConfigs[toolKey] || {};

    if (provider) {
      // Validate config; create step regardless but flag issues
      const validationErrors = provider.validateConfig(config);

      stepsToInsert.push({
        requestId,
        toolKey,
        status: "pending" as const,
        config,
        executionOrder: provider.defaultExecutionOrder,
        maxAttempts: provider.supportsRetry ? 3 : 1,
        idempotencyKey: generateStepIdempotencyKey(requestId, toolKey, 1),
      });
      stepsCreated++;

      if (validationErrors.length > 0) {
        manualTasksToInsert.push({
          requestId,
          title: `Review ${provider.displayName} configuration`,
          description: `Config validation warnings: ${validationErrors.join(", ")}`,
          toolKey,
          status: "pending" as const,
        });
        manualTasksCreated++;
      }
    } else {
      // No provider = fully manual tool (e.g., Fathom)
      manualTasksToInsert.push({
        requestId,
        title: `Manually provision ${toolKey} access`,
        description: `No automated provider exists for ${toolKey}. Provision manually.`,
        toolKey,
        status: "pending" as const,
      });
      manualTasksCreated++;
    }
  }

  // 5. Insert steps and manual tasks
  if (stepsToInsert.length > 0) {
    await db.insert(provisioningSteps).values(stepsToInsert);
  }
  if (manualTasksToInsert.length > 0) {
    await db.insert(manualTasks).values(manualTasksToInsert);
  }

  // 6. Update request status
  await db
    .update(onboardingRequests)
    .set({
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date(),
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, requestId));

  // 7. Audit
  await audit({
    action: "request_approved",
    requestId,
    actorId,
    actorEmail,
    details: {
      stepsCreated,
      manualTasksCreated,
      tools: requestedTools,
    },
  });

  return {
    requestId,
    stepsCreated,
    manualTasksCreated,
    toolConfigs: finalConfigs,
  };
}

/**
 * Recalculate and update the request status based on provisioning step statuses.
 */
export async function refreshRequestStatus(requestId: string): Promise<OnboardingStatus> {
  const steps = await db.query.provisioningSteps.findMany({
    where: eq(provisioningSteps.requestId, requestId),
  });

  const request = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, requestId),
  });
  const statuses = steps.map((s) => s.status);
  const emailSent = request?.status === "email_sent" || request?.status === "complete";
  const newStatus = resolveRequestStatus(statuses, request?.status || "approved", emailSent);

  await db
    .update(onboardingRequests)
    .set({
      status: newStatus,
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, requestId));

  return newStatus;
}

/**
 * Check if a request can transition to a given status.
 */
export function canTransition(
  current: OnboardingStatus,
  target: OnboardingStatus
): boolean {
  const allowed: Partial<Record<OnboardingStatus, OnboardingStatus[]>> = {
    draft: ["pending_approval"],
    pending_approval: ["approved", "draft"],
    approved: ["provisioning_in_progress"],
    provisioning_in_progress: [
      "partially_provisioned",
      "awaiting_manual_action",
      "complete",
      "failed",
      "email_sent",
    ],
    partially_provisioned: [
      "provisioning_in_progress",
      "awaiting_manual_action",
      "complete",
      "failed",
    ],
    awaiting_manual_action: ["provisioning_in_progress", "complete", "failed"],
    email_sent: ["complete"],
    complete: ["offboarded"],
    failed: ["provisioning_in_progress", "draft"],
  };

  return allowed[current]?.includes(target) ?? false;
}

// ---- Helpers ----

function buildFormOverrides(
  request: typeof onboardingRequests.$inferSelect,
  toolKey: string
): ProvisioningConfig {
  const overrides: ProvisioningConfig = {};

  if (toolKey === "slack" && request.slackChannels) {
    overrides.channels = request.slackChannels as string[];
  }
  if (toolKey === "google_workspace" && request.googleGroups) {
    overrides.groups = request.googleGroups as string[];
  }
  if (toolKey === "clickup" && request.clickupAccessType) {
    overrides.permissions = [request.clickupAccessType];
  }
  if (toolKey === "onepassword" && request.onepasswordVaultProfile) {
    overrides.vault_names = [request.onepasswordVaultProfile];
  }

  return overrides;
}

function mergeLayeredConfigs(
  ...layers: ProvisioningConfig[]
): ProvisioningConfig {
  const merged: ProvisioningConfig = {};

  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && Array.isArray(merged[key])) {
        merged[key] = [...new Set([...(merged[key] as string[]), ...value])];
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

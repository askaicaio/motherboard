import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq } from "drizzle-orm";
import { evaluateRules } from "@/lib/rules/engine";
import { getProvider, getAllProviders } from "@/lib/providers/registry";
import { generateStepIdempotencyKey } from "@/lib/utils/idempotency";
import { audit } from "@/lib/audit/logger";
import type { ToolKey } from "@/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;

  const request_data = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, id),
  });

  if (!request_data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (request_data.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve request in status: ${request_data.status}` },
      { status: 400 }
    );
  }

  // Run rules engine
  const ruleConfigs = await evaluateRules({
    department: request_data.department,
    division: request_data.division,
    jobTitle: request_data.jobTitle,
  });

  // Merge rule-based configs with explicitly requested tools
  const requestedTools = (request_data.requestedTools as ToolKey[]) || [];
  const allToolKeys = new Set([...ruleConfigs.keys(), ...requestedTools]);

  // Create provisioning steps for each tool
  const stepsToInsert = [];
  for (const toolKey of allToolKeys) {
    let provider;
    try {
      provider = getProvider(toolKey);
    } catch {
      continue; // Skip unregistered tools
    }

    const ruleConfig = ruleConfigs.get(toolKey) || {};
    const config = { ...ruleConfig };

    // Apply form-level overrides
    if (toolKey === "slack" && request_data.slackChannels) {
      const channels = request_data.slackChannels as string[];
      if (channels.length > 0) {
        config.channels = [...new Set([...(config.channels || []), ...channels])];
      }
    }
    if (toolKey === "google_workspace" && request_data.googleGroups) {
      const groups = request_data.googleGroups as string[];
      if (groups.length > 0) {
        config.groups = [...new Set([...(config.groups || []), ...groups])];
      }
    }
    if (toolKey === "clickup" && request_data.clickupAccessType) {
      config.role = request_data.clickupAccessType;
    }
    if (toolKey === "onepassword" && request_data.onepasswordVaultProfile) {
      config.vault_names = [request_data.onepasswordVaultProfile];
    }

    stepsToInsert.push({
      requestId: id,
      toolKey,
      config,
      executionOrder: provider.defaultExecutionOrder,
      idempotencyKey: generateStepIdempotencyKey(id, toolKey, 1),
    });
  }

  // Insert steps and update request status
  if (stepsToInsert.length > 0) {
    await db.insert(provisioningSteps).values(stepsToInsert);
  }

  const [updated] = await db
    .update(onboardingRequests)
    .set({
      status: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, id))
    .returning();

  await audit({
    action: "request_approved",
    requestId: id,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      toolKeys: Array.from(allToolKeys),
      stepCount: stepsToInsert.length,
    },
  });

  return NextResponse.json(updated);
}

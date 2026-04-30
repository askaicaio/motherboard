import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps, onboardingEmails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyN8nSignature } from "@/lib/n8n/client";
import { getProvider } from "@/lib/providers/registry";
import { resolveRequestStatus } from "@/lib/utils/status-resolver";
import { audit } from "@/lib/audit/logger";
import type { N8nCallbackPayload } from "@/lib/n8n/types";
import type { ToolProvisionStatus } from "@/types";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-N8N-Signature") || "";

  // Verify HMAC signature
  if (!verifyN8nSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: N8nCallbackPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stepId, toolKey, status, data, error, retryable, executionId } = payload;

  if (!stepId || !toolKey) {
    return NextResponse.json({ error: "Missing stepId or toolKey" }, { status: 400 });
  }

  // Look up the step
  const step = await db.query.provisioningSteps.findFirst({
    where: eq(provisioningSteps.id, stepId),
  });

  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  // Parse the callback through the provider
  const provider = getProvider(toolKey);
  const result = provider.parseN8nCallback(payload);

  // Determine new step status
  let newStatus: ToolProvisionStatus;
  if (result.success) {
    newStatus = "success";
  } else if (result.requiresManualAction) {
    newStatus = "manual_required";
  } else {
    newStatus = "failed";
  }

  // Update the step
  await db
    .update(provisioningSteps)
    .set({
      status: newStatus,
      resultData: result.data ?? null,
      errorMessage: result.errorMessage ?? null,
      n8nExecutionId: executionId ?? step.n8nExecutionId,
      updatedAt: new Date(),
    })
    .where(eq(provisioningSteps.id, stepId));

  // Audit log
  await audit({
    action: result.success ? "provisioning_step_completed" : "provisioning_step_failed",
    requestId: step.requestId,
    details: {
      stepId,
      toolKey,
      status: newStatus,
      errorMessage: result.errorMessage,
      requiresManualAction: result.requiresManualAction,
    },
  });

  // Recompute request status
  const allSteps = await db
    .select()
    .from(provisioningSteps)
    .where(eq(provisioningSteps.requestId, step.requestId));

  const stepStatuses = allSteps.map((s) =>
    s.id === stepId ? newStatus : (s.status as ToolProvisionStatus)
  );

  const requestData = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, step.requestId),
  });

  if (!requestData) {
    return NextResponse.json({ ok: true });
  }

  // Check if email has been sent
  const emailExists = await db.query.onboardingEmails.findFirst({
    where: eq(onboardingEmails.requestId, step.requestId),
  });

  const newRequestStatus = resolveRequestStatus(
    stepStatuses,
    requestData.status,
    !!emailExists?.sentAt
  );

  if (newRequestStatus !== requestData.status) {
    await db
      .update(onboardingRequests)
      .set({
        status: newRequestStatus,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingRequests.id, step.requestId));

    await audit({
      action: "status_changed",
      requestId: step.requestId,
      details: {
        from: requestData.status,
        to: newRequestStatus,
        trigger: `callback_${toolKey}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

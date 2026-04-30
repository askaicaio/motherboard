import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq, and, inArray } from "drizzle-orm";
import { getProvider } from "@/lib/providers/registry";
import { triggerN8nWebhook } from "@/lib/n8n/client";
import { generateStepIdempotencyKey } from "@/lib/utils/idempotency";
import { audit } from "@/lib/audit/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stepIds: string[] | undefined = body.stepIds;

  const request_data = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, id),
  });

  if (!request_data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Get failed steps
  let failedSteps;
  if (stepIds && stepIds.length > 0) {
    failedSteps = await db
      .select()
      .from(provisioningSteps)
      .where(
        and(
          eq(provisioningSteps.requestId, id),
          eq(provisioningSteps.status, "failed"),
          inArray(provisioningSteps.id, stepIds)
        )
      );
  } else {
    failedSteps = await db
      .select()
      .from(provisioningSteps)
      .where(
        and(
          eq(provisioningSteps.requestId, id),
          eq(provisioningSteps.status, "failed")
        )
      );
  }

  if (failedSteps.length === 0) {
    return NextResponse.json({ error: "No failed steps to retry" }, { status: 400 });
  }

  // Update request status back to provisioning
  await db
    .update(onboardingRequests)
    .set({
      status: "provisioning_in_progress",
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, id));

  const results = [];
  for (const step of failedSteps) {
    if (step.attemptCount >= step.maxAttempts) {
      results.push({
        stepId: step.id,
        toolKey: step.toolKey,
        skipped: true,
        reason: "Max attempts reached",
      });
      continue;
    }

    const provider = getProvider(step.toolKey);
    if (!provider.supportsRetry) {
      results.push({
        stepId: step.id,
        toolKey: step.toolKey,
        skipped: true,
        reason: "Provider does not support retry",
      });
      continue;
    }

    const newAttempt = step.attemptCount + 1;
    const newIdempotencyKey = generateStepIdempotencyKey(id, step.toolKey, newAttempt);

    const payload = provider.buildN8nPayload({
      requestId: id,
      stepId: step.id,
      idempotencyKey: newIdempotencyKey,
      employee: {
        name: request_data.employeeName,
        email: request_data.employeeEmail,
        personalEmail: request_data.personalEmail ?? undefined,
        jobTitle: request_data.jobTitle,
        department: request_data.department,
        division: request_data.division,
        managerEmail: request_data.managerEmail ?? undefined,
        startDate: request_data.startDate,
      },
      config: step.config as Record<string, unknown>,
      attemptNumber: newAttempt,
    });

    const triggerResult = await triggerN8nWebhook(payload);

    await db
      .update(provisioningSteps)
      .set({
        status: triggerResult.triggered ? "in_progress" : "failed",
        attemptCount: newAttempt,
        lastAttemptedAt: new Date(),
        idempotencyKey: newIdempotencyKey,
        n8nExecutionId: triggerResult.executionId ?? null,
        errorMessage: triggerResult.triggered ? null : (triggerResult.error ?? null),
        updatedAt: new Date(),
      })
      .where(eq(provisioningSteps.id, step.id));

    results.push({
      stepId: step.id,
      toolKey: step.toolKey,
      triggered: triggerResult.triggered,
      attemptNumber: newAttempt,
    });
  }

  await audit({
    action: "provisioning_retried",
    requestId: id,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { retried: results },
  });

  return NextResponse.json({ status: "retry_triggered", results });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq } from "drizzle-orm";
import { getProvider } from "@/lib/providers/registry";
import { triggerN8nWebhook } from "@/lib/n8n/client";
import { audit } from "@/lib/audit/logger";

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

  if (request_data.status !== "approved") {
    return NextResponse.json(
      { error: `Cannot provision request in status: ${request_data.status}` },
      { status: 400 }
    );
  }

  // Get all pending steps ordered by execution_order
  const steps = await db
    .select()
    .from(provisioningSteps)
    .where(eq(provisioningSteps.requestId, id))
    .orderBy(provisioningSteps.executionOrder);

  if (steps.length === 0) {
    return NextResponse.json({ error: "No provisioning steps found" }, { status: 400 });
  }

  // Update request status
  await db
    .update(onboardingRequests)
    .set({
      status: "provisioning_in_progress",
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, id));

  await audit({
    action: "provisioning_started",
    requestId: id,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      stepCount: steps.length,
      toolKeys: steps.map((s) => s.toolKey),
    },
  });

  // Trigger each step
  const results = [];
  for (const step of steps) {
    if (step.status !== "pending") continue;

    const provider = getProvider(step.toolKey);
    const config = step.config as Record<string, unknown>;

    // Validate config
    const validationErrors = provider.validateConfig(config);
    if (validationErrors.length > 0) {
      await db
        .update(provisioningSteps)
        .set({
          status: "failed",
          errorMessage: `Config validation failed: ${validationErrors.join(", ")}`,
          updatedAt: new Date(),
        })
        .where(eq(provisioningSteps.id, step.id));

      results.push({ stepId: step.id, toolKey: step.toolKey, triggered: false, error: validationErrors });
      continue;
    }

    const payload = provider.buildN8nPayload({
      requestId: id,
      stepId: step.id,
      idempotencyKey: step.idempotencyKey,
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
      config,
      attemptNumber: step.attemptCount + 1,
    });

    const triggerResult = await triggerN8nWebhook(payload);

    // Update step status
    await db
      .update(provisioningSteps)
      .set({
        status: triggerResult.triggered ? "in_progress" : "failed",
        attemptCount: step.attemptCount + 1,
        lastAttemptedAt: new Date(),
        n8nExecutionId: triggerResult.executionId ?? null,
        errorMessage: triggerResult.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(provisioningSteps.id, step.id));

    await audit({
      action: "provisioning_step_started",
      requestId: id,
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      details: {
        stepId: step.id,
        toolKey: step.toolKey,
        triggered: triggerResult.triggered,
        attemptNumber: step.attemptCount + 1,
      },
    });

    results.push({
      stepId: step.id,
      toolKey: step.toolKey,
      triggered: triggerResult.triggered,
      executionId: triggerResult.executionId,
    });
  }

  return NextResponse.json({ status: "provisioning_started", results });
}

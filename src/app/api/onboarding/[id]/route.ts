import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps, onboardingEmails, auditLogs } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const request_data = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, id),
  });

  if (!request_data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const [steps, emails, recentAudit] = await Promise.all([
    db
      .select()
      .from(provisioningSteps)
      .where(eq(provisioningSteps.requestId, id))
      .orderBy(provisioningSteps.executionOrder),
    db
      .select()
      .from(onboardingEmails)
      .where(eq(onboardingEmails.requestId, id))
      .orderBy(desc(onboardingEmails.createdAt)),
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.requestId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  ]);

  return NextResponse.json({
    ...request_data,
    provisioningSteps: steps,
    emails,
    auditHistory: recentAudit,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await db.query.onboardingRequests.findFirst({
    where: eq(onboardingRequests.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["draft", "pending_approval"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Cannot update request in current status" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(onboardingRequests)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(onboardingRequests.id, id))
    .returning();

  return NextResponse.json(updated);
}

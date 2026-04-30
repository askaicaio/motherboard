import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests, provisioningSteps, onboardingEmails } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq } from "drizzle-orm";
import { buildOnboardingEmail } from "@/lib/email/builder";
import { sendEmail } from "@/lib/email/sender";
import { audit } from "@/lib/audit/logger";
import { TOOL_DISPLAY_NAMES, type ToolKey } from "@/types";

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

  const steps = await db
    .select()
    .from(provisioningSteps)
    .where(eq(provisioningSteps.requestId, id));

  const provisionedTools = steps.map((step) => ({
    toolKey: step.toolKey,
    displayName: TOOL_DISPLAY_NAMES[step.toolKey as ToolKey] || step.toolKey,
    status: step.status,
    config: step.config as Record<string, unknown>,
    resultData: step.resultData as Record<string, unknown> | undefined,
  }));

  const email = buildOnboardingEmail({
    employee: {
      name: request_data.employeeName,
      preferredName: request_data.preferredName ?? undefined,
      email: request_data.employeeEmail,
      jobTitle: request_data.jobTitle,
      department: request_data.department,
      division: request_data.division,
      startDate: request_data.startDate,
      managerName: request_data.managerName ?? undefined,
    },
    provisionedTools,
    companyName: "Chief AI Officer",
    supportEmail: "support@chiefaiofficer.com",
  });

  const sendTo = request_data.personalEmail || request_data.employeeEmail;
  const result = await sendEmail({
    to: sendTo,
    subject: email.subject,
    html: email.html,
    plain: email.plain,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: `Failed to send email: ${result.error}` },
      { status: 500 }
    );
  }

  // Save email record
  await db.insert(onboardingEmails).values({
    requestId: id,
    subject: email.subject,
    htmlBody: email.html,
    plainBody: email.plain,
    sentAt: new Date(),
    sentTo: sendTo,
    messageId: result.messageId ?? null,
  });

  // Update request status
  await db
    .update(onboardingRequests)
    .set({
      status: "email_sent",
      statusChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingRequests.id, id));

  await audit({
    action: "email_sent",
    requestId: id,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { sentTo: sendTo, messageId: result.messageId },
  });

  return NextResponse.json({ success: true, messageId: result.messageId });
}

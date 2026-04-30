import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingEmails } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq, desc } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sender";
import { audit } from "@/lib/audit/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;

  // Find the most recent email for this request
  const lastEmail = await db
    .select()
    .from(onboardingEmails)
    .where(eq(onboardingEmails.requestId, id))
    .orderBy(desc(onboardingEmails.createdAt))
    .limit(1);

  if (lastEmail.length === 0) {
    return NextResponse.json(
      { error: "No email has been sent for this request yet. Use send first." },
      { status: 400 }
    );
  }

  const emailRecord = lastEmail[0];

  const result = await sendEmail({
    to: emailRecord.sentTo,
    subject: emailRecord.subject,
    html: emailRecord.htmlBody,
    plain: emailRecord.plainBody,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: `Failed to resend email: ${result.error}` },
      { status: 500 }
    );
  }

  // Update resend count
  await db
    .update(onboardingEmails)
    .set({
      resendCount: emailRecord.resendCount + 1,
      sentAt: new Date(),
      messageId: result.messageId ?? emailRecord.messageId,
    })
    .where(eq(onboardingEmails.id, emailRecord.id));

  await audit({
    action: "email_resent",
    requestId: id,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      sentTo: emailRecord.sentTo,
      resendCount: emailRecord.resendCount + 1,
    },
  });

  return NextResponse.json({ success: true });
}

// POST /api/partners/[id]/decline — decline a partner application (admin).
// Sets status='declined', stamps declinedAt, records the reason.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";
import { sendTemplatedEmail } from "@/lib/email/render";

/** Escape user-entered text before embedding it in the decline email HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const declineSchema = z.object({
  reason: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;

  let body: z.infer<typeof declineSchema> = {};
  try {
    // Body is optional — tolerate an empty request.
    const json = await request.json().catch(() => ({}));
    body = declineSchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const now = new Date();
  const reason = body.reason?.trim() || null;
  const [updated] = await db
    .update(partners)
    .set({
      status: "declined",
      declinedAt: now,
      declineReason: reason,
      // Revoke any pending portal set-password/reset token.
      passwordToken: null,
      passwordTokenExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(partners.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Notify the applicant — best-effort (sendTemplatedEmail never throws). The
  // admin-entered reason, when present, is escaped and wrapped in a styled block
  // so it shows inside the branded email; otherwise the block collapses away.
  const firstName = updated.name?.trim().split(/\s+/)[0] || "there";
  const reasonBlock = reason
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>A note from our team:</strong><br/>${escapeHtml(
        reason,
      )}</p>`
    : "";
  if (updated.email) {
    await sendTemplatedEmail("application_declined", updated.email, {
      firstName,
      reasonBlock,
    });
  }

  return NextResponse.json({ partner: updated });
}

// POST /api/partners/disputes/[id]/decide — admin records a dispute decision.
// Sets status + resolution + decidedAt=now + decidedBy=user.id.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerDisputes, partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sendEmail } from "@/lib/email/sender";
import { eq } from "drizzle-orm";

function portalBaseUrl(): string {
  return (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://affiliates.chiefaiofficer.com"
  ).replace(/\/$/, "");
}

/**
 * Best-effort decision notification to the affiliate. Never throws — a mail
 * failure must not roll back a recorded decision.
 */
async function notifyAffiliate(
  partner: { name: string; email: string },
  status: "upheld" | "denied" | "closed",
  resolution: string | null,
) {
  // "closed" is an administrative no-decision — don't email the affiliate.
  if (status === "closed") return;

  const disputesUrl = `${portalBaseUrl()}/portal/disputes`;
  const firstName = partner.name.split(" ")[0] || "there";
  const upheld = status === "upheld";

  const subject = upheld
    ? "Your referral dispute was approved"
    : "Update on your referral dispute";

  const outcomeLine = upheld
    ? "Good news — we reviewed your dispute and approved it. We'll credit the referral to your account."
    : "We've reviewed your dispute and weren't able to approve it this time.";

  const resolutionBlock = resolution
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>${escapeHtml(
        resolution,
      )}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e1b4b;">
      <p style="font-size:16px;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size:15px;line-height:1.6;">${outcomeLine}</p>
      ${resolutionBlock}
      <p style="margin:24px 0;">
        <a href="${disputesUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">View your disputes</a>
      </p>
      <p style="font-size:13px;color:#64748b;">— The Chief AI Officer Affiliate Team</p>
    </div>`;

  const plain = [
    `Hi ${firstName},`,
    "",
    upheld
      ? "Good news — we reviewed your dispute and approved it. We'll credit the referral to your account."
      : "We've reviewed your dispute and weren't able to approve it this time.",
    resolution ? `\nNote from our team:\n${resolution}` : "",
    "",
    `View your disputes: ${disputesUrl}`,
    "",
    "— The Chief AI Officer Affiliate Team",
  ].join("\n");

  try {
    await sendEmail({ to: partner.email, subject, html, plain });
  } catch (err) {
    console.error("[disputes/decide] notify email failed:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const decideSchema = z.object({
  status: z.enum(["upheld", "denied", "closed"]),
  resolution: z.string().max(10000).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;

  let body;
  try {
    body = decideSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [updated] = await db
    .update(partnerDisputes)
    .set({
      status: body.status,
      resolution: body.resolution?.trim() || null,
      decidedAt: new Date(),
      decidedBy: user.id,
    })
    .where(eq(partnerDisputes.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  // Best-effort affiliate notification — must never fail the decision.
  try {
    const [partner] = await db
      .select({ name: partners.name, email: partners.email })
      .from(partners)
      .where(eq(partners.id, updated.partnerId))
      .limit(1);
    if (partner) {
      await notifyAffiliate(partner, body.status, updated.resolution);
    }
  } catch (err) {
    console.error("[disputes/decide] post-decision notify failed:", err);
  }

  return NextResponse.json({ dispute: updated });
}

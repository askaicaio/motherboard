// POST /api/partners/disputes/[id]/decide — admin records a dispute decision.
// Sets status + resolution + decidedAt=now + decidedBy=user.id.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  partnerDisputes,
  partners,
  partnerPrograms,
  partnerConversions,
  partnerConversionEvents,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sendEmail } from "@/lib/email/sender";
import { renderBrandedEmail, emailButton } from "@/lib/email/template";
import { getActiveSettings } from "@/lib/partners/queries";
import {
  resolveRate,
  computeCommission,
  computeWindows,
} from "@/lib/partners/rules";
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
  credited: boolean,
) {
  // "closed" is an administrative no-decision — don't email the affiliate.
  if (status === "closed") return;

  const disputesUrl = `${portalBaseUrl()}/portal/disputes`;
  const firstName = partner.name.split(" ")[0] || "there";
  const upheld = status === "upheld";

  const subject = upheld
    ? "Your referral dispute was approved"
    : "Update on your referral dispute";

  const heading = upheld
    ? "Your dispute was approved"
    : "Update on your dispute";

  const outcomeLine = upheld
    ? "Good news — we reviewed your dispute and approved it."
    : "We've reviewed your dispute and weren't able to approve it this time.";

  const creditLine =
    upheld && credited
      ? `<p style="margin:0 0 16px;">We've added the earned commission to your account. It now appears in your Events and will be included in your next payout — no further action needed.</p>`
      : "";

  const resolutionBlock = resolution
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>${escapeHtml(
        resolution,
      )}</p>`
    : "";

  const html = renderBrandedEmail({
    heading,
    preheader: outcomeLine,
    contentHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px;">${outcomeLine}</p>
      ${creditLine}
      ${resolutionBlock}
      ${emailButton("View your disputes", disputesUrl)}
    `,
  });

  const plain = [
    `Hi ${firstName},`,
    "",
    outcomeLine,
    upheld && credited
      ? "\nWe've added the earned commission to your account. It now appears in your Events and will be included in your next payout — no further action needed."
      : "",
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
  /** When upheld, optionally credit the affiliate inline. */
  creditProgramId: z.string().uuid().optional(),
  creditGrossCents: z.number().int().min(0).optional(),
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

  // Look up the existing dispute first so we know the partnerId for crediting.
  const [existing] = await db
    .select()
    .from(partnerDisputes)
    .where(eq(partnerDisputes.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  const wantsCredit =
    body.status === "upheld" &&
    !!body.creditProgramId &&
    typeof body.creditGrossCents === "number";

  let updated: typeof partnerDisputes.$inferSelect;
  let credited = false;

  if (wantsCredit) {
    // Resolve the program + active settings and compute the commission BEFORE
    // the transaction so a misconfiguration fails the request cleanly.
    const [program] = await db
      .select()
      .from(partnerPrograms)
      .where(eq(partnerPrograms.id, body.creditProgramId!))
      .limit(1);

    if (!program) {
      return NextResponse.json(
        { error: "Credit program not found" },
        { status: 400 },
      );
    }

    const now = new Date();
    const settings = await getActiveSettings(now);
    if (!settings) {
      return NextResponse.json(
        { error: "No active partner settings — cannot compute commission" },
        { status: 400 },
      );
    }

    const rate = resolveRate(program, settings);
    const gross = body.creditGrossCents!;
    const { commissionableCents, commissionCents } = computeCommission({
      grossCents: gross,
      feesCents: 0,
      nonCommissionableCents: 0,
      rate,
    });
    const { refundWindowEndsAt, disputeWindowEndsAt } = computeWindows(
      now,
      settings.refundWindowDays,
    );

    updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(partnerDisputes)
        .set({
          status: body.status,
          resolution: body.resolution?.trim() || null,
          decidedAt: now,
          decidedBy: user.id,
        })
        .where(eq(partnerDisputes.id, id))
        .returning();

      const [conv] = await tx
        .insert(partnerConversions)
        .values({
          partnerId: existing.partnerId,
          programId: program.id,
          buyerEmail: "dispute-credit@chiefaiofficer.com",
          grossCents: gross,
          feesCents: 0,
          nonCommissionableCents: 0,
          commissionableCents,
          commissionCents,
          currency: "USD",
          externalOrderId: `dispute-${id}`,
          source: "manual",
          purchasedAt: now,
          isNewCustomer: true,
          status: "earned",
          refundWindowEndsAt,
          disputeWindowEndsAt,
          earnedAt: now,
        })
        // Idempotent: a prior credit for this dispute won't double-insert.
        .onConflictDoNothing({
          target: [
            partnerConversions.source,
            partnerConversions.externalOrderId,
          ],
        })
        .returning();

      if (conv) {
        await tx.insert(partnerConversionEvents).values({
          conversionId: conv.id,
          eventType: "dispute_credit",
          toStatus: "earned",
          actorId: user.id,
          actorEmail: user.email,
          details: { disputeId: id, programId: program.id, grossCents: gross },
        });
      }

      return u;
    });

    credited = true;
  } else {
    const [u] = await db
      .update(partnerDisputes)
      .set({
        status: body.status,
        resolution: body.resolution?.trim() || null,
        decidedAt: new Date(),
        decidedBy: user.id,
      })
      .where(eq(partnerDisputes.id, id))
      .returning();
    updated = u;
  }

  // Best-effort affiliate notification — must never fail the decision.
  try {
    const [partner] = await db
      .select({ name: partners.name, email: partners.email })
      .from(partners)
      .where(eq(partners.id, updated.partnerId))
      .limit(1);
    if (partner) {
      await notifyAffiliate(partner, body.status, updated.resolution, credited);
    }
  } catch (err) {
    console.error("[disputes/decide] post-decision notify failed:", err);
  }

  return NextResponse.json({ dispute: updated });
}

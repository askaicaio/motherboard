// POST /api/partners/[id]/approve — approve a partner (admin).
// Sets status='active', stamps approvedAt/approvedBy, ensures a real refCode,
// issues a temporary password (forced change on first login), and emails the
// affiliate their referral link + temp password.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { generateRefCode } from "@/lib/partners/rules";
import { sendEmail } from "@/lib/email/sender";
import { renderBrandedEmail } from "@/lib/email/template";
import { eq } from "drizzle-orm";

/** Readable, URL-safe temporary password, e.g. "Caio-a1B2c3D4". */
function generateTempPassword(): string {
  const suffix = randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, 8)
    .padEnd(8, "0");
  return `Caio-${suffix}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    // Temporary password — the affiliate is forced to choose their own on first
    // portal login (mustChangePassword).
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const approvalFields = {
      status: "active" as const,
      approvedAt: now,
      approvedBy: user.id,
      passwordHash,
      mustChangePassword: true,
      // Clear any pending set-password token — temp-password flow supersedes it.
      passwordToken: null,
      passwordTokenExpiresAt: null,
      updatedAt: now,
    };

    // Mint a real refCode on approval if it's missing OR still the apply-form
    // placeholder ("pending_<ts>"). Retry up to 5x on unique-violation.
    const needsRefCode =
      !existing.refCode || existing.refCode.startsWith("pending_");

    let updated = existing;
    if (needsRefCode) {
      let saved: typeof existing | undefined;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          [saved] = await db
            .update(partners)
            .set({ ...approvalFields, refCode: generateRefCode() })
            .where(eq(partners.id, id))
            .returning();
          break;
        } catch (err) {
          lastErr = err;
          const code = (err as { code?: string }).code;
          if (code === "23505" && /ref_code/.test(String(err))) continue;
          throw err;
        }
      }
      if (!saved) throw lastErr ?? new Error("Failed to assign ref code");
      updated = saved;
    } else {
      const [saved] = await db
        .update(partners)
        .set(approvalFields)
        .where(eq(partners.id, id))
        .returning();
      updated = saved;
    }

    // Build the referral + login links from env.
    const base = (
      process.env.PARTNER_PROGRAM_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://affiliates.chiefaiofficer.com"
    ).replace(/\/$/, "");
    const link = `${base}/r?aff=${updated.refCode}`;
    const loginUrl = `${base}/portal/login`;

    const portalBlockHtml = `
      <p>Sign in to your affiliate portal to track your clicks, conversions, and payouts.</p>
      <p>Your temporary password is: <strong>${tempPassword}</strong></p>
      <p><a href="${loginUrl}">Sign in to your portal →</a></p>
      <p>You'll be asked to choose your own password on first sign-in.</p>`;

    const contentHtml = `
      <p>Hi ${updated.name},</p>
      <p>Great news — your application to the CAIO Affiliate Program has been approved!</p>
      <p>Your personal referral link is:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Share it with anyone who could benefit from working with a Chief AI Officer.
      When they engage through your link, you'll earn commission on qualifying sales.</p>
      ${portalBlockHtml}
      <p>Welcome aboard,<br/>The CAIO Team</p>
    `.trim();

    const html = renderBrandedEmail({
      heading: "You're approved!",
      contentHtml,
      preheader:
        "Your referral link and temporary portal password are inside.",
    });

    const plain = [
      `Hi ${updated.name},`,
      "",
      "Great news — your application to the CAIO Affiliate Program has been approved!",
      "",
      "Your personal referral link is:",
      link,
      "",
      "Share it with anyone who could benefit from working with a Chief AI Officer. " +
        "When they engage through your link, you'll earn commission on qualifying sales.",
      "",
      "Sign in to your affiliate portal to track clicks, conversions, and payouts.",
      `Your temporary password is: ${tempPassword}`,
      loginUrl,
      "You'll be asked to choose your own password on first sign-in.",
      "",
      "Welcome aboard,",
      "The CAIO Team",
    ].join("\n");

    // Email is best-effort — never let a mail hiccup fail an approval that the
    // DB already committed. (The admin can re-send / the partner can reset.)
    try {
      await sendEmail({
        to: updated.email,
        subject: "You're approved for the CAIO Affiliate Program",
        html,
        plain,
      });
    } catch (emailErr) {
      console.error(
        "[approve] approval saved but email send failed:",
        emailErr,
      );
    }

    return NextResponse.json({ partner: updated });
  } catch (err) {
    console.error("[approve] failed:", err);
    // Postgres "undefined_column" — schema is behind the code (missing migration).
    const code = (err as { code?: string }).code;
    if (code === "42703") {
      return NextResponse.json(
        {
          error:
            "The database is missing a required column. Run migrations 0021 and 0022, then try again.",
        },
        { status: 500 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Approval failed: ${message}` },
      { status: 500 },
    );
  }
}

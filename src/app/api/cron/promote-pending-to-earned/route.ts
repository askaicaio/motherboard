// =============================================================
// Cron: promote pending → earned once the refund window passes
// =============================================================
// Scheduled hourly via vercel.json. Any partner_conversion that is still
// pending and whose refund_window_ends_at has elapsed — refund-free —
// flips to earned (Terms §3.4 / Playbook §17). promotePendingToEarned also
// writes an in-app "commission confirmed" notice to each affiliate and returns
// the promoted rows; here we email each affiliate a grouped thank-you with the
// expected payout date. Mirrors the auth pattern of sync-ghl-campaigns.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import {
  promotePendingToEarned,
  type PromotedConversion,
} from "@/lib/partners/lifecycle";
import { getActiveSettings } from "@/lib/partners/queries";
import { computePayableAt } from "@/lib/partners/rules";
import { sendTemplatedEmail } from "@/lib/email/render";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * Email each affiliate whose referral(s) just cleared verification — a grouped
 * thank-you (one email per affiliate per run) with the expected payout date.
 * Best-effort: skips sample affiliates and never throws.
 */
async function emailVerifiedReferrals(
  promoted: PromotedConversion[],
  now: Date,
) {
  if (promoted.length === 0) return;
  try {
    const settings = await getActiveSettings(now);
    const payoutTermsDays = settings?.payoutTermsDays ?? 45;
    const minPayoutCents = settings?.minPayoutCents ?? 10000;
    const expectedPayoutDate = computePayableAt(
      now,
      payoutTermsDays,
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const minPayout = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(minPayoutCents / 100);

    // Group promoted rows per affiliate so each gets ONE email.
    const byPartner = new Map<
      string,
      { commissionCents: number; count: number; currency: string }
    >();
    for (const p of promoted) {
      const g =
        byPartner.get(p.partnerId) ??
        { commissionCents: 0, count: 0, currency: p.currency };
      g.commissionCents += p.commissionCents;
      g.count += 1;
      byPartner.set(p.partnerId, g);
    }

    const rows = await db
      .select({
        id: partners.id,
        name: partners.name,
        email: partners.email,
        isSample: partners.isSample,
      })
      .from(partners)
      .where(inArray(partners.id, [...byPartner.keys()]));

    for (const partner of rows) {
      if (partner.isSample || !partner.email) continue;
      const g = byPartner.get(partner.id);
      if (!g) continue;
      const amount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (g.currency || "USD").toUpperCase(),
      }).format(g.commissionCents / 100);
      await sendTemplatedEmail("referral_verified", partner.email, {
        name: partner.name.split(" ")[0] || "there",
        referrals: `${g.count} referral${g.count === 1 ? "" : "s"}`,
        amount,
        expectedPayoutDate,
        minPayout,
      });
    }
  } catch (err) {
    console.error("[cron/promote] verified-email failed:", err);
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const promoted = await promotePendingToEarned(now);
    await emailVerifiedReferrals(promoted, now);
    return NextResponse.json({ ok: true, promoted: promoted.length });
  } catch (err) {
    console.error("[cron/promote] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}

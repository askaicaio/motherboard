// GET /api/portal/connect/status — refresh the logged-in affiliate's Stripe
// Connect status from Stripe and persist it. Called after the affiliate returns
// from onboarding (?connect=done). Scoped to the logged-in partner only.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPartnerSession } from "@/lib/partners/session";
import { getStripe } from "@/lib/integrations/stripe-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No connected account yet — nothing to refresh.
  if (!partner.stripeConnectAccountId) {
    return NextResponse.json({ status: partner.stripeConnectStatus ?? "none" });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ status: partner.stripeConnectStatus ?? "none" });
  }

  try {
    const account = await stripe.accounts.retrieve(
      partner.stripeConnectAccountId,
    );

    let status: string;
    if (
      account.payouts_enabled ||
      account.charges_enabled ||
      account.capabilities?.transfers === "active"
    ) {
      status = "ready";
    } else if (account.requirements?.disabled_reason) {
      // Stripe has blocked the account (more info required / under review).
      status = "restricted";
    } else {
      status = "onboarding";
    }

    if (status !== partner.stripeConnectStatus) {
      await db
        .update(partners)
        .set({ stripeConnectStatus: status, updatedAt: new Date() })
        .where(eq(partners.id, partner.id));
    }

    return NextResponse.json({ status });
  } catch (err) {
    // Stripe error — don't crash, just report the last-known persisted status.
    console.error("[portal/connect/status] failed:", err);
    return NextResponse.json({ status: partner.stripeConnectStatus ?? "none" });
  }
}

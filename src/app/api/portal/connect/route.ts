// POST /api/portal/connect — start (or resume) Stripe Connect Express
// onboarding for the logged-in affiliate. Creates the connected account on
// first call, persists it, then returns a one-time onboarding link to redirect
// the affiliate to. Scoped to the logged-in partner only; read-only during an
// admin "View as" impersonation.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { getStripe } from "@/lib/integrations/stripe-client";

export const dynamic = "force-dynamic";

const base = (
  process.env.PARTNER_PROGRAM_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://affiliates.chiefaiofficer.com"
).replace(/\/$/, "");

export async function POST() {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await getImpersonation()) {
    return NextResponse.json(
      { error: "Read-only while viewing as an affiliate." },
      { status: 403 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Payouts are not configured yet. Please contact support." },
      { status: 503 },
    );
  }

  try {
    let accountId = partner.stripeConnectAccountId;

    // First time: create the Express connected account + persist it.
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: partner.email,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await db
        .update(partners)
        .set({
          stripeConnectAccountId: accountId,
          stripeConnectStatus: "onboarding",
          updatedAt: new Date(),
        })
        .where(eq(partners.id, partner.id));
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/portal/payouts?connect=refresh`,
      return_url: `${base}/portal/payouts?connect=done`,
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    // Connect not enabled on the platform account (or any other Stripe error) —
    // return a clear 503 rather than crashing. Manual ACH still works.
    const message =
      err instanceof Error ? err.message : "Could not start payout setup.";
    console.error("[portal/connect] failed:", err);
    return NextResponse.json(
      {
        error:
          "Stripe Connect isn't available yet. You can still get paid via the tax/banking form below.",
        detail: message,
      },
      { status: 503 },
    );
  }
}

// =============================================================
// POST /api/stripe/webhook
// =============================================================
// Stripe → Partner Program adapter. Signature-verified. Dispatches:
//   checkout.session.completed  → ingestConversion (source of truth;
//                                 we deliberately do NOT also handle
//                                 payment_intent.succeeded — Checkout
//                                 fires both and that double-counts)
//   charge.refunded (full)      → reverse, or clawback if already paid
//   charge.dispute.created      → reverse, or clawback if already paid
//
// Idempotency: ingestConversion is unique on (source, external_order_id)
// where external_order_id = the Checkout Session id; reverse/clawback are
// idempotent. So Stripe redeliveries are safe without a separate
// processed-events table.
//
// Status codes matter to Stripe's retry logic: 400 on bad signature
// (do NOT retry), 500 on handler failure (DO retry), 200 on success.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { partnerConversions, partnerConversionEvents, partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, webhookSecret } from "@/lib/integrations/stripe-client";
import { ingestConversion } from "@/lib/partners/ingest";
import { resolveProgram } from "@/lib/partners/queries";
import { reverseConversion, createClawback } from "@/lib/partners/lifecycle";
import { sendTemplatedEmail } from "@/lib/email/render";
import { sendPurchaseWebhook } from "@/lib/integrations/zapier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where product-purchase handovers go — the team that onboards the new client,
// separate from the affiliate-program owner inbox. Overridable via env.
const HANDOVER_TEAM_EMAIL =
  process.env.HANDOVER_TEAM_EMAIL || "onboarding@chiefaiofficer.com";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Only count actually-paid sessions.
  if (session.payment_status !== "paid") return;

  const stripe = getStripe();

  const affId =
    (session.metadata?.aff_id as string | undefined) ||
    session.client_reference_id ||
    null;

  // Program: prefer explicit metadata; else resolve by the line item price.
  let programRef = (session.metadata?.program as string | undefined) || null;
  if (!programRef) {
    try {
      const items = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
      });
      programRef = items.data[0]?.price?.id ?? null;
    } catch (err) {
      console.error("[stripe] listLineItems failed:", err);
    }
  }
  if (!programRef) {
    console.error(
      `[stripe] checkout ${session.id} — could not resolve program; skipping`,
    );
    return;
  }

  const buyerEmail = session.customer_details?.email || "";
  if (!buyerEmail) {
    console.error(`[stripe] checkout ${session.id} — no buyer email; skipping`);
    return;
  }

  // Resolve the charge id for later refund/dispute matching.
  let stripeChargeId: string | null = null;
  if (session.payment_intent && typeof session.payment_intent === "string") {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge;
      stripeChargeId =
        typeof charge === "string" ? charge : charge?.id ?? null;
    } catch (err) {
      console.error("[stripe] paymentIntent retrieve failed:", err);
    }
  }

  const result = await ingestConversion({
    buyerEmail,
    programRef,
    grossCents: session.amount_total ?? 0,
    feesCents: session.total_details?.amount_tax ?? 0,
    nonCommissionableCents: 0,
    externalOrderId: session.id,
    source: "stripe",
    purchasedAt: session.created
      ? new Date(session.created * 1000)
      : new Date(),
    affId,
    cookieId: (session.metadata?.cookie_id as string | undefined) || null,
    stripeSessionId: session.id,
    stripeChargeId,
    currency: (session.currency || "usd").toUpperCase(),
  });

  // Fan out exactly once per NEW paid purchase. idempotentReplay means this was
  // a Stripe redelivery (the row already existed) — skip so we don't double-send.
  // A "rejected" conversion (unmatched affiliate) is still a real purchase that
  // needs onboarding, so we do NOT gate on status.
  if (result.ok && !result.idempotentReplay) {
    await handleNewPurchase(session, programRef, affId);
  }
  // (The $1 test product is auto-refunded 95% ~1 day later by the
  // test-product-refunds cron — not here — so testers see the charge settle
  // first, then the partial refund.)
}

type ResolvedProgram = Awaited<ReturnType<typeof resolveProgram>> | null;

/**
 * Everything that fans out from a NEW paid purchase: the buyer + handover
 * emails, and the Zapier webhook that drives the no-code automations (Dani's
 * personal per-product emails, the Slack ping for the CAIO cert). The program is
 * resolved ONCE here and shared by both. Each step is independently best-effort
 * — one failing must not skip the others, and none may throw, since a throw
 * returns 500 and makes Stripe retry an already-ingested event.
 */
async function handleNewPurchase(
  session: Stripe.Checkout.Session,
  programRef: string,
  affId: string | null,
) {
  let program: ResolvedProgram = null;
  try {
    program = await resolveProgram(programRef);
  } catch (err) {
    console.error("[stripe] resolveProgram failed:", err);
  }

  await sendPurchaseEmails(session, program, affId);
  await sendPurchaseZap(session, program, programRef, affId);
}

/** Buyer's display name + first name from the Stripe session (may be absent). */
function buyerNames(session: Stripe.Checkout.Session): {
  buyerName: string;
  firstName: string;
} {
  const buyerName = session.customer_details?.name || "";
  return { buyerName, firstName: buyerName.split(" ")[0] || "there" };
}

/** Amount actually paid, formatted for display (e.g. "$12,000.00"). */
function paidAmount(session: Stripe.Checkout.Session): {
  currency: string;
  amount: string;
} {
  const currency = (session.currency || "usd").toUpperCase();
  return {
    currency,
    amount: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format((session.amount_total ?? 0) / 100),
  };
}

/**
 * Email (a) the buyer a generic branded confirmation and (b) the handover team
 * so they can onboard the client. Best-effort — never throws.
 */
async function sendPurchaseEmails(
  session: Stripe.Checkout.Session,
  program: ResolvedProgram,
  affId: string | null,
) {
  try {
    const buyerEmail = session.customer_details?.email || "";
    if (!buyerEmail) return;

    const { buyerName, firstName } = buyerNames(session);
    const { amount } = paidAmount(session);
    const programName = program?.name ?? "your CAIO program";

    // (a) Buyer confirmation.
    await sendTemplatedEmail("purchase_confirmation", buyerEmail, {
      firstName,
      programName,
      amount,
    });

    // (b) Handover team alert.
    if (HANDOVER_TEAM_EMAIL) {
      await sendTemplatedEmail("purchase_handover", HANDOVER_TEAM_EMAIL, {
        buyerName: buyerName || "(name not provided)",
        buyerEmail,
        programName,
        amount,
        referredBy: affId || "direct",
      });
    }
  } catch (err) {
    console.error("[stripe] purchase emails failed:", err);
  }
}

/**
 * Notify Zapier of the purchase so the no-code Zap can branch on program_slug
 * (Dani's Kickstart / ROI Blueprint emails, the CAIO-cert Slack ping to Katie).
 * sendPurchaseWebhook is itself best-effort + timeout-bounded; this wrapper only
 * guards the payload assembly.
 */
async function sendPurchaseZap(
  session: Stripe.Checkout.Session,
  program: ResolvedProgram,
  programRef: string,
  affId: string | null,
) {
  try {
    const buyerEmail = session.customer_details?.email || "";
    if (!buyerEmail) return;

    const { buyerName, firstName } = buyerNames(session);
    const { amount, currency } = paidAmount(session);

    await sendPurchaseWebhook({
      event: "purchase.completed",
      occurred_at: new Date().toISOString(),
      first_name: firstName,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      program_name: program?.name ?? "CAIO program",
      // Fall back to the raw ref so the Zap still sees something identifying.
      program_slug: program?.slug ?? programRef,
      amount_formatted: amount,
      amount_cents: session.amount_total ?? 0,
      currency,
      // Sentinel rather than "" so Zapier/Slack renders something readable
      // ("Referred by: direct") instead of a blank.
      affiliate_code: affId || "direct",
      is_test_purchase: program?.isSample ?? false,
      stripe_session_id: session.id,
    });
  } catch (err) {
    console.error("[stripe] purchase zap failed:", err);
  }
}

/**
 * Find the conversion tied to a Stripe charge and reverse/clawback it.
 * The lookup + the reverse-vs-clawback decision + the mutation all happen
 * inside ONE transaction holding a FOR UPDATE lock on the conversion, so
 * a concurrent refund + dispute on the same charge serialize and can't
 * double-reverse or double-clawback.
 */
async function handleChargeReversal(chargeId: string, reason: string) {
  if (!chargeId) return;
  // Captured inside the tx, emailed AFTER it commits — never mid-transaction,
  // which would hold the FOR UPDATE lock across a network call.
  let reversed:
    | { partnerId: string; commissionCents: number; currency: string }
    | null = null;
  await db.transaction(async (tx) => {
    const [conv] = await tx
      .select()
      .from(partnerConversions)
      .where(eq(partnerConversions.stripeChargeId, chargeId))
      .for("update")
      .limit(1);
    if (!conv) {
      console.warn(
        `[stripe] ${reason}: no conversion for charge ${chargeId} — manual review`,
      );
      return;
    }
    if (conv.status === "reversed") return; // already terminal — don't re-notify
    if (conv.status === "paid") {
      await createClawback(conv.id, reason, { actorEmail: "system:stripe" }, tx);
    } else {
      await reverseConversion(conv.id, reason, { actorEmail: "system:stripe" }, tx);
    }
    // Only notify for a real, commissioned, partner-matched conversion.
    if (conv.partnerId && conv.commissionCents > 0) {
      reversed = {
        partnerId: conv.partnerId,
        commissionCents: conv.commissionCents,
        currency: conv.currency || "USD",
      };
    }
  });

  if (reversed) await notifyAffiliateOfReversal(reversed, reason);
}

/**
 * Email the affiliate that a commission was reversed. Best-effort: skips
 * sample/test affiliates and never throws — a mail hiccup must not fail the
 * webhook and make Stripe retry an already-applied reversal.
 */
async function notifyAffiliateOfReversal(
  info: { partnerId: string; commissionCents: number; currency: string },
  reason: string,
) {
  try {
    const [p] = await db
      .select({
        name: partners.name,
        email: partners.email,
        isSample: partners.isSample,
      })
      .from(partners)
      .where(eq(partners.id, info.partnerId))
      .limit(1);
    if (!p?.email || p.isSample) return;

    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (info.currency || "USD").toUpperCase(),
    }).format(info.commissionCents / 100);

    const isDispute = /dispute/i.test(reason);
    const reasonText = isDispute
      ? "The purchase was disputed (a chargeback was filed), so this referral no longer qualifies for a commission."
      : "The customer was refunded, so this referral no longer qualifies for a commission.";
    const reasonBlock = `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;">${reasonText}</p>`;

    await sendTemplatedEmail("commission_reversed", p.email, {
      name: p.name?.split(" ")[0] || "there",
      amount,
      reasonBlock,
    });
  } catch (err) {
    console.error("[stripe] commission-reversed email failed:", err);
  }
}

/**
 * A PARTIAL refund lowers the commission basis (§3.3) but the event alone
 * can't tell us how to re-split gross/fees/non-commissionable, so we don't
 * auto-adjust. Instead we persist a durable review signal: a
 * partial_refund_review event that (a) shows up in the admin queue and
 * (b) holds the conversion back from auto-promotion until reconciled.
 */
async function flagPartialRefund(charge: Stripe.Charge) {
  const [conv] = await db
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.stripeChargeId, charge.id))
    .limit(1);
  if (!conv) {
    console.warn(
      `[stripe] partial refund on charge ${charge.id} — no conversion; manual review`,
    );
    return;
  }
  await db.insert(partnerConversionEvents).values({
    conversionId: conv.id,
    eventType: "partial_refund_review",
    fromStatus: conv.status,
    toStatus: conv.status,
    actorEmail: "system:stripe",
    details: {
      reason: "stripe_partial_refund",
      amountRefundedCents: charge.amount_refunded,
      chargeAmountCents: charge.amount,
      chargeId: charge.id,
    },
  });
}

export async function POST(request: NextRequest) {
  const secret = webhookSecret();
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    // Bad signature → 400 so Stripe does NOT retry a forged/invalid call.
    console.error(
      "[stripe] signature verification failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // charge.refunded (bool) is true only on a FULL refund. A full
        // refund voids the whole commission; a partial refund lowers the
        // basis and needs admin reconciliation (we can't safely re-split
        // gross/fees/non-commissionable from the event alone).
        if (charge.refunded) {
          await handleChargeReversal(charge.id, "stripe_refund");
        } else {
          await flagPartialRefund(charge);
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge?.id ?? "";
        await handleChargeReversal(chargeId, "stripe_dispute");
        break;
      }

      default:
        // Ignore everything else.
        break;
    }
  } catch (err) {
    // Handler failure on a valid event → 500 so Stripe retries.
    console.error(`[stripe] handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

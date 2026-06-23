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
import { partnerConversions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, webhookSecret } from "@/lib/integrations/stripe-client";
import { ingestConversion } from "@/lib/partners/ingest";
import { reverseConversion, createClawback } from "@/lib/partners/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  await ingestConversion({
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
}

/** Find the conversion tied to a Stripe charge and reverse/clawback it. */
async function handleChargeReversal(chargeId: string, reason: string) {
  if (!chargeId) return;
  const [conv] = await db
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.stripeChargeId, chargeId))
    .limit(1);
  if (!conv) {
    console.warn(
      `[stripe] ${reason}: no conversion for charge ${chargeId} — manual review`,
    );
    return;
  }
  if (conv.status === "paid") {
    await createClawback(conv.id, reason, { actorEmail: "system:stripe" });
  } else {
    await reverseConversion(conv.id, reason, { actorEmail: "system:stripe" });
  }
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
        // Only act on FULL refunds. Partial refunds change the basis but
        // we don't auto-reverse the whole commission — flag for admin.
        if (charge.refunded) {
          await handleChargeReversal(charge.id, "stripe_refund");
        } else {
          console.warn(
            `[stripe] partial refund on charge ${charge.id} (refunded ${charge.amount_refunded}/${charge.amount}) — admin review`,
          );
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

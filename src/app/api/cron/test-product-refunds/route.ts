// =============================================================
// Cron: refund 95% of the $1 TEST product ~1 day after purchase
// =============================================================
// The $1 test product exists to exercise the real payment flow in live mode.
// Buyers are charged the full $1 (so the charge settles for real), then this
// cron refunds 95% (= $0.95) once the charge is ~1 day old — leaving a ~$0.05
// net cost per test. Lets the team verify: the charge goes through, a refund
// succeeds, and the 95% is computed correctly.
//
// Scoped to ONE program slug (default "test-product-1", override with
// TEST_PRODUCT_SLUG). Idempotent: it only refunds charges Stripe still shows as
// un-refunded (amount_refunded === 0), so re-runs never double-refund. Runs
// hourly via vercel.json so the refund lands close to the 24h mark.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerConversions, partnerPrograms } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { getStripe } from "@/lib/integrations/stripe-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TEST_SLUG = process.env.TEST_PRODUCT_SLUG || "test-product-1";
const REFUND_FRACTION = 0.95;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const cutoff = new Date(now - 24 * 60 * 60 * 1000); // >= 1 day old
  const windowStart = new Date(now - 7 * 24 * 60 * 60 * 1000); // bound the scan

  // Resolve the test product.
  const [prog] = await db
    .select({ id: partnerPrograms.id })
    .from(partnerPrograms)
    .where(eq(partnerPrograms.slug, TEST_SLUG))
    .limit(1);
  if (!prog) {
    return NextResponse.json({ ok: true, skipped: `no program "${TEST_SLUG}"` });
  }

  // Its Stripe conversions from the last week that are now >= 1 day old.
  const rows = await db
    .select({
      id: partnerConversions.id,
      stripeChargeId: partnerConversions.stripeChargeId,
    })
    .from(partnerConversions)
    .where(
      and(
        eq(partnerConversions.programId, prog.id),
        eq(partnerConversions.source, "stripe"),
        isNotNull(partnerConversions.stripeChargeId),
        lte(partnerConversions.purchasedAt, cutoff),
        gte(partnerConversions.purchasedAt, windowStart),
      ),
    )
    .limit(50);

  const stripe = getStripe();
  let refunded = 0;
  let skipped = 0;

  for (const r of rows) {
    const chargeId = r.stripeChargeId;
    if (!chargeId) continue;
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      // Only refund a still-untouched, succeeded charge — this is the idempotency
      // guard (a re-run finds amount_refunded > 0 and skips).
      if (charge.status !== "succeeded" || (charge.amount_refunded ?? 0) > 0) {
        skipped++;
        continue;
      }
      const amount = Math.round(charge.amount * REFUND_FRACTION);
      await stripe.refunds.create({ charge: chargeId, amount });
      refunded++;
      console.info(
        `[cron/test-product-refunds] refunded ${amount}¢ (95%) on charge ${chargeId}`,
      );
    } catch (err) {
      console.error(
        `[cron/test-product-refunds] refund failed for charge ${chargeId}:`,
        err,
      );
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, refunded, skipped });
}

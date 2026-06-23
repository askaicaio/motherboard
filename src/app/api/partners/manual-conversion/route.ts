// =============================================================
// POST /api/partners/manual-conversion
// =============================================================
// Admin-only ingestion path for sales-led deals (Strategic Oversight,
// Embedded Fractional CAIO) and corrections. Runs the exact same rules
// + lifecycle as the Stripe adapter via ingestConversion(source=manual).
//
// For sales-led programs the partner is attributed via a direct_intro
// event; pass the partner's ref_code as affId to bind it directly, or
// leave it off to let email-matching find the direct_intro.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { ingestConversion } from "@/lib/partners/ingest";

export const dynamic = "force-dynamic";

const schema = z.object({
  buyerEmail: z.string().email(),
  /** program id | slug */
  programRef: z.string().min(1),
  grossCents: z.number().int().nonnegative(),
  feesCents: z.number().int().nonnegative().optional().default(0),
  nonCommissionableCents: z.number().int().nonnegative().optional().default(0),
  /** ISO 8601. Defaults to now. */
  purchasedAt: z.string().datetime().optional(),
  /** Partner ref_code to bind directly (optional — else email-match). */
  affId: z.string().optional().nullable(),
  /** Free-form external reference for idempotency (e.g. contract id). */
  externalOrderId: z.string().optional().nullable(),
  currency: z.string().length(3).optional().default("USD"),
});

export async function POST(request: NextRequest) {
  const user = await requireRole("admin");

  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const result = await ingestConversion({
    buyerEmail: body.buyerEmail,
    programRef: body.programRef,
    grossCents: body.grossCents,
    feesCents: body.feesCents,
    nonCommissionableCents: body.nonCommissionableCents,
    externalOrderId: body.externalOrderId ?? `manual:${user.id}:${body.buyerEmail}:${body.grossCents}`,
    source: "manual",
    purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date(),
    affId: body.affId ?? null,
    currency: body.currency.toUpperCase(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json(result, { status: 201 });
}

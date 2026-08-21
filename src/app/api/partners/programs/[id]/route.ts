// PATCH /api/partners/programs/[id] — update a program (admin only).
// Editable: name, listValueCents, active, commissionRateOverride (string|null),
// setupFeeCents, stripeFeePassthroughCents, description.
//
// KEEPING STRIPE IN SYNC (why this route talks to Stripe at all):
// the list value is what /enroll advertises, but checkout charges the Stripe
// PRICE. If those two drift, a customer sees one number and is charged another.
// So an amount change is reconciled with Stripe here, before the DB write:
//   - Stripe Price.unit_amount is IMMUTABLE — you cannot edit a price. The only
//     way to change what's charged is to CREATE a new price on the same product,
//     point the program at it, and deactivate the old one.
//   - A name change updates the Stripe Product name (that one IS mutable), so
//     the checkout page shows the new title.
// If Stripe rejects the change we return an error and do NOT save the new
// amount — refusing the edit is better than persisting a price the customer
// won't actually be charged.
//
// The slug is never editable (it's the stable identifier used in referral URLs,
// checkout metadata, and attribution). Stripe IDs are never hand-edited — they
// are managed here and by [id]/stripe-sync. Such keys in the body are stripped.
//
// DELETE /api/partners/programs/[id] — soft-delete (archive): set archivedAt =
// now() and active = false. Restore via [id]/restore.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { getStripe } from "@/lib/integrations/stripe-client";
import { eq } from "drizzle-orm";

const patchSchema = z
  .object({
    active: z.boolean().optional(),
    // Editable marketing blurb for the /enroll cards (AI-draftable).
    description: z.string().max(2000).nullable().optional(),
    // Decimal string e.g. "0.12", or null to fall back to the default rate.
    commissionRateOverride: z
      .string()
      .regex(/^\d*\.?\d+$/, "Must be a decimal like 0.12")
      .refine((v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 1;
      }, "Rate must be between 0 and 1")
      .nullable()
      .optional(),
    setupFeeCents: z.number().int().min(0).optional(),
    stripeFeePassthroughCents: z.number().int().min(0).optional(),
    // Editable display fields. The slug + Stripe IDs stay fixed (see header).
    name: z.string().trim().min(1).max(200).optional(),
    listValueCents: z.number().int().min(0).optional(),
  })
  // Silently drop any stripe IDs a client might send — they are read-only here.
  .strip();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;
  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  // Load the current row so we can tell what ACTUALLY changed — we only touch
  // Stripe when the name or the amount really moved.
  const [existing] = await db
    .select()
    .from(partnerPrograms)
    .where(eq(partnerPrograms.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.active !== undefined) patch.active = body.active;
  if (body.description !== undefined)
    patch.description = body.description?.trim() || null;
  if (body.commissionRateOverride !== undefined)
    patch.commissionRateOverride = body.commissionRateOverride;
  if (body.setupFeeCents !== undefined) patch.setupFeeCents = body.setupFeeCents;
  if (body.stripeFeePassthroughCents !== undefined)
    patch.stripeFeePassthroughCents = body.stripeFeePassthroughCents;
  if (body.name !== undefined) patch.name = body.name;
  if (body.listValueCents !== undefined)
    patch.listValueCents = body.listValueCents;

  const nameChanged = body.name !== undefined && body.name !== existing.name;
  const amountChanged =
    body.listValueCents !== undefined &&
    body.listValueCents !== existing.listValueCents;

  // ── Reconcile Stripe BEFORE persisting, so the DB can never advertise a
  // price the customer won't be charged. Sales-led programs and programs not
  // yet wired to Stripe have nothing to reconcile.
  let stripeNote: string | null = null;
  if (
    (nameChanged || amountChanged) &&
    !existing.salesLed &&
    existing.stripeProductId
  ) {
    try {
      const stripe = getStripe();

      if (nameChanged) {
        await stripe.products.update(existing.stripeProductId, {
          name: body.name!,
        });
      }

      if (amountChanged && existing.stripePriceId) {
        // Preserve the existing price's currency, and refuse to silently
        // convert a recurring price into a one-time one.
        const oldPrice = await stripe.prices.retrieve(existing.stripePriceId);
        if (oldPrice.recurring) {
          return NextResponse.json(
            {
              error:
                "This product uses a recurring Stripe price. Change the amount in Stripe directly so the billing interval isn't lost.",
            },
            { status: 400 },
          );
        }

        // unit_amount is immutable — create a replacement price.
        const newPrice = await stripe.prices.create({
          product: existing.stripeProductId,
          currency: oldPrice.currency || "usd",
          unit_amount: body.listValueCents!,
        });

        // Make it the product's default, then retire the old price so nothing
        // can start a new checkout at the stale amount. In-flight sessions
        // created with the old price still complete normally.
        await stripe.products.update(existing.stripeProductId, {
          default_price: newPrice.id,
        });
        await stripe.prices.update(existing.stripePriceId, { active: false });

        patch.stripePriceId = newPrice.id;
        stripeNote = `Stripe price updated — new price ${newPrice.id} created, previous price retired.`;
      } else if (amountChanged && !existing.stripePriceId) {
        stripeNote =
          'Saved. This product has no Stripe price yet — use "Create in Stripe" to wire it up.';
      }
    } catch (err) {
      console.error("[programs] Stripe reconciliation failed:", err);
      // Refuse the whole edit rather than persist a divergent amount.
      return NextResponse.json(
        {
          error:
            (err instanceof Error ? err.message : "Stripe update failed") +
            " — nothing was saved, so the listed price still matches what Stripe charges.",
        },
        { status: 502 },
      );
    }
  }

  const [updated] = await db
    .update(partnerPrograms)
    .set(patch)
    .where(eq(partnerPrograms.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ program: updated, stripeNote });
}

// DELETE — archive (soft-delete) a program. It stays in the DB for history but
// is hidden from affiliate-facing surfaces. Restore via [id]/restore.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;

  const [archived] = await db
    .update(partnerPrograms)
    .set({ archivedAt: new Date(), active: false, updatedAt: new Date() })
    .where(eq(partnerPrograms.id, id))
    .returning();

  if (!archived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ program: archived });
}

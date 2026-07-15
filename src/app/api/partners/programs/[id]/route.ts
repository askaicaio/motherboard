// PATCH /api/partners/programs/[id] — update an eligible program (admin only).
// Editable: active, commissionRateOverride (string|null), setupFeeCents,
// stripeFeePassthroughCents.
// Stripe IDs (stripeProductId/stripePriceId) are NEVER hand-edited here — they
// are managed solely by /api/partners/programs/[id]/stripe-sync. Any such keys
// in the incoming body are stripped and ignored.
// DELETE /api/partners/programs/[id] — soft-delete (archive): set archivedAt =
// now() and active = false. Restore via [id]/restore.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
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

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.active !== undefined) patch.active = body.active;
  if (body.description !== undefined)
    patch.description = body.description?.trim() || null;
  if (body.commissionRateOverride !== undefined)
    patch.commissionRateOverride = body.commissionRateOverride;
  if (body.setupFeeCents !== undefined) patch.setupFeeCents = body.setupFeeCents;
  if (body.stripeFeePassthroughCents !== undefined)
    patch.stripeFeePassthroughCents = body.stripeFeePassthroughCents;

  const [updated] = await db
    .update(partnerPrograms)
    .set(patch)
    .where(eq(partnerPrograms.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ program: updated });
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

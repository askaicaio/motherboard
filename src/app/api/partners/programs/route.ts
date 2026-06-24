// POST /api/partners/programs — create a new partner program (admin only).
// Stripe IDs are NEVER accepted here — they are managed solely by the
// /api/partners/programs/[id]/stripe-sync route.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

/** Turn a free-text name into a URL-friendly slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain a-z, 0-9 and hyphens")
    .optional(),
  listValueCents: z.number().int().min(0),
  commissionRateOverride: z
    .string()
    .regex(/^\d*\.?\d+$/, "Must be a decimal like 0.12")
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 1;
    }, "Rate must be between 0 and 1")
    .nullable()
    .optional(),
  salesLed: z.boolean().optional(),
  setupFeeCents: z.number().int().min(0).optional(),
  stripeFeePassthroughCents: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  await requireRole("admin");

  let body;
  try {
    body = createSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const slug = body.slug && body.slug.length > 0 ? body.slug : slugify(body.name);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not derive a slug from the name — provide one explicitly." },
      { status: 400 },
    );
  }

  // Guard against duplicate slugs (slug drives landing-page routes).
  const [existing] = await db
    .select({ id: partnerPrograms.id })
    .from(partnerPrograms)
    .where(eq(partnerPrograms.slug, slug))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: `A program with the slug "${slug}" already exists.` },
      { status: 409 },
    );
  }

  // Stripe IDs are intentionally omitted — stripe-sync owns them.
  const [created] = await db
    .insert(partnerPrograms)
    .values({
      name: body.name,
      slug,
      listValueCents: body.listValueCents,
      commissionRateOverride: body.commissionRateOverride ?? null,
      salesLed: body.salesLed ?? false,
      setupFeeCents: body.setupFeeCents ?? 0,
      stripeFeePassthroughCents: body.stripeFeePassthroughCents ?? 0,
    })
    .returning();

  return NextResponse.json({ program: created }, { status: 201 });
}

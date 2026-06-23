// POST /api/partners/programs/[id]/stripe-sync
// ------------------------------------------------------------------
// One-click: create (or reuse) a Stripe Product + Price for a self-serve
// program, using the app's Stripe key, and save the IDs back on the
// program so the public checkout link goes live. Idempotent — if the
// program already has a stripePriceId we return it unchanged.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { getStripe } from "@/lib/integrations/stripe-client";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;

  const [program] = await db
    .select()
    .from(partnerPrograms)
    .where(eq(partnerPrograms.id, id))
    .limit(1);
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if (program.salesLed) {
    return NextResponse.json(
      { error: "Sales-led programs have no self-serve checkout to wire." },
      { status: 400 },
    );
  }
  if (program.stripePriceId) {
    return NextResponse.json({
      ok: true,
      alreadyWired: true,
      stripeProductId: program.stripeProductId,
      stripePriceId: program.stripePriceId,
    });
  }

  try {
    const stripe = getStripe();
    // Reuse the product if we already created one, else make it.
    let productId = program.stripeProductId;
    if (!productId) {
      const product = await stripe.products.create({
        name: program.name,
        metadata: { partner_program_slug: program.slug },
      });
      productId = product.id;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: program.listValueCents,
    });

    const [updated] = await db
      .update(partnerPrograms)
      .set({
        stripeProductId: productId,
        stripePriceId: price.id,
        updatedAt: new Date(),
      })
      .where(eq(partnerPrograms.id, id))
      .returning();

    return NextResponse.json({
      ok: true,
      stripeProductId: updated.stripeProductId,
      stripePriceId: updated.stripePriceId,
    });
  } catch (err) {
    console.error("[stripe-sync] failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Stripe product/price creation failed. Check STRIPE_SECRET_KEY has Products + Prices write scope.",
      },
      { status: 502 },
    );
  }
}

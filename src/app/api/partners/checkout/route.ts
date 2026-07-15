// =============================================================
// POST /api/partners/checkout
// =============================================================
// Creates a Stripe Checkout Session for a self-serve program, carrying
// the affiliate id through so the conversion can be attributed. Called
// by the public landing page (separate prompt). Public by design — it
// only creates sessions for known, active, Stripe-wired programs, and a
// created-but-unpaid session costs nothing.
//
// The affiliate id rides through three redundant channels so attribution
// survives even if one is dropped:
//   - client_reference_id = ref_code
//   - session.metadata.aff_id = ref_code
//   - payment_intent_data.metadata.aff_id = ref_code (propagates to charge)
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/integrations/stripe-client";
import { resolveProgram } from "@/lib/partners/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  /** program id | slug | stripe price id */
  programRef: z.string().min(1),
  affId: z.string().optional().nullable(),
  cookieId: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  successUrl: z.string().url().optional().nullable(),
  cancelUrl: z.string().url().optional().nullable(),
});

function baseUrl(): string {
  return (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://chiefaiofficer.com"
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
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
    // Malformed / non-JSON body — return JSON, never let it become an HTML 500.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Everything past parsing is wrapped so this endpoint ALWAYS returns JSON.
  // A non-JSON 500 (e.g. an unhandled throw in resolveProgram or a Stripe/config
  // error) is what surfaces on the client as a generic "Network error" — here it
  // comes back as a real, readable message instead.
  try {
    const program = await resolveProgram(body.programRef);
    if (!program || !program.active) {
      return NextResponse.json(
        { error: "Unknown or inactive program" },
        { status: 404 },
      );
    }
    if (program.salesLed || !program.stripePriceId) {
      return NextResponse.json(
        {
          error:
            "This program isn't set up for self-serve checkout yet (no Stripe price wired).",
        },
        { status: 400 },
      );
    }

    const affId = body.affId?.trim() || undefined;
    const meta: Record<string, string> = { program: program.slug };
    if (affId) meta.aff_id = affId;
    if (body.cookieId) meta.cookie_id = body.cookieId;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: program.stripePriceId, quantity: 1 }],
      success_url:
        body.successUrl ||
        `${baseUrl()}/partners/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl || `${baseUrl()}/partners`,
      client_reference_id: affId,
      customer_email: body.customerEmail || undefined,
      metadata: meta,
      // Mirror metadata onto the PaymentIntent so it lands on the Charge too.
      payment_intent_data: { metadata: meta },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("[checkout] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 },
    );
  }
}

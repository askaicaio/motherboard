// POST /api/portal/disputes — partner submits an attribution dispute from
// the portal, scoped to themselves. Enforces the 14-day window using the
// AUTHORITATIVE server-side value when a conversion is referenced.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerDisputes, partnerConversions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getPartnerSession } from "@/lib/partners/session";
import { disputeWithinWindow } from "@/lib/partners/rules";

export const dynamic = "force-dynamic";

const schema = z.object({
  conversionId: z.string().uuid().optional().nullable(),
  dealCloseDate: z.string().datetime(),
  evidence: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const now = new Date();
  // Stored close date. For conversion-anchored disputes we trust the ingested
  // purchase date, never the client-supplied value.
  let dealClose = new Date(body.dealCloseDate);

  if (body.conversionId) {
    const [conv] = await db
      .select({
        id: partnerConversions.id,
        partnerId: partnerConversions.partnerId,
        purchasedAt: partnerConversions.purchasedAt,
        disputeWindowEndsAt: partnerConversions.disputeWindowEndsAt,
      })
      .from(partnerConversions)
      .where(eq(partnerConversions.id, body.conversionId))
      .limit(1);

    // Positive ownership: a referenced conversion must be THIS partner's own.
    // This blocks both another partner's rows AND unmatched (NULL-partner) rows
    // — a partner who believes an uncredited deal is theirs files without a
    // conversionId and describes it in the evidence instead.
    if (!conv || conv.partnerId !== partner.id) {
      return NextResponse.json(
        { error: "That conversion isn't associated with your account." },
        { status: 403 },
      );
    }

    // Enforce the 14-day window from the AUTHORITATIVE server-side value
    // (purchased_at + 14d), not the attacker-controllable request body.
    if (conv.disputeWindowEndsAt && now > conv.disputeWindowEndsAt) {
      return NextResponse.json(
        { error: "The 14-day dispute window for that conversion has passed." },
        { status: 422 },
      );
    }
    // Anchor the stored close date to the real purchase date.
    dealClose = conv.purchasedAt ?? dealClose;

    // Avoid duplicate open disputes for the same conversion by this partner.
    const [dupe] = await db
      .select({ id: partnerDisputes.id })
      .from(partnerDisputes)
      .where(
        and(
          eq(partnerDisputes.partnerId, partner.id),
          eq(partnerDisputes.conversionId, body.conversionId),
          eq(partnerDisputes.status, "open"),
        ),
      )
      .limit(1);
    if (dupe) {
      return NextResponse.json(
        { error: "You already have an open dispute for that conversion." },
        { status: 409 },
      );
    }
  } else {
    // No conversion reference — soft-enforce against the supplied close date so
    // a partner can't file on a deal they themselves report as long closed.
    if (!disputeWithinWindow(dealClose, now)) {
      return NextResponse.json(
        { error: "The 14-day dispute window (from the deal close date) has passed." },
        { status: 422 },
      );
    }
  }

  const [created] = await db
    .insert(partnerDisputes)
    .values({
      partnerId: partner.id,
      conversionId: body.conversionId ?? null,
      dealCloseDate: dealClose,
      evidence: body.evidence.trim(),
      status: "open",
    })
    .returning();

  return NextResponse.json({ dispute: created }, { status: 201 });
}

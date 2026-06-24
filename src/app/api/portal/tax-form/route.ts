// POST /api/portal/tax-form — partner submits their tax form type + payout
// details from the portal. Scoped to the logged-in partner only.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  taxFormStatus: z.enum(["w9", "w8ben", "w8bene"]),
  payoutMethod: z.enum(["ach", "zelle"]),
  payoutDetails: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await getImpersonation()) {
    return NextResponse.json(
      { error: "Read-only while viewing as an affiliate." },
      { status: 403 },
    );
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

  const [updated] = await db
    .update(partners)
    .set({
      taxFormStatus: body.taxFormStatus,
      payoutMethod: body.payoutMethod,
      payoutDetails: body.payoutDetails?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(partners.id, partner.id))
    .returning();

  return NextResponse.json({
    ok: true,
    taxFormStatus: updated.taxFormStatus,
    payoutMethod: updated.payoutMethod,
  });
}

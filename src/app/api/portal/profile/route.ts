// PATCH /api/portal/profile — the logged-in affiliate updates their own contact
// address. Name/email stay admin-managed; tax + payout live on their own pages.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { COUNTRY_OPTIONS } from "@/lib/partners/geo";

export const dynamic = "force-dynamic";

const schema = z.object({
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(200),
  postalCode: z.string().trim().min(1).max(50),
  country: z.enum(COUNTRY_OPTIONS as unknown as [string, ...string[]]),
});

export async function PATCH(request: NextRequest) {
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

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please fill in every address field." },
        { status: 400 },
      );
    }
    throw err;
  }

  await db
    .update(partners)
    .set({
      address: body.address,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      updatedAt: new Date(),
    })
    .where(eq(partners.id, partner.id));

  return NextResponse.json({ ok: true });
}

// POST /api/partners/[id]/view-as — admin opens an affiliate's portal as them.
// Sets a short-lived, signed, READ-ONLY impersonation session (imp flag inside
// the HMAC token). Portal write endpoints reject impersonated sessions.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";
import { setImpersonationSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;

  const [partner] = await db
    .select({ id: partners.id, status: partners.status, name: partners.name })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);

  if (!partner) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }
  if (!["approved", "active"].includes(partner.status)) {
    return NextResponse.json(
      { error: "You can only view active or approved affiliates." },
      { status: 422 },
    );
  }

  await setImpersonationSession(partner.id);

  const base = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://affiliates.chiefaiofficer.com"
  ).replace(/\/$/, "");

  return NextResponse.json({ ok: true, portalUrl: `${base}/portal` });
}

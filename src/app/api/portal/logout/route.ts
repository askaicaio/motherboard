// POST /api/portal/logout — clear the partner session.
import { NextResponse } from "next/server";
import { clearPartnerSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearPartnerSession();
  return NextResponse.json({ ok: true });
}

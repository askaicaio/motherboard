// POST /api/portal/exit-view-as — end an admin "View as" impersonation session.
// Safe to call for any session; only meaningful for impersonation. Clears the
// partner cookie so the admin drops back to their own staff session.
import { NextResponse } from "next/server";
import { clearPartnerSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearPartnerSession();
  return NextResponse.json({ ok: true });
}

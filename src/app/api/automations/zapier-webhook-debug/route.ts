// =============================================================
// TEMPORARY: auth-gated management for the Zapier webhook inspector
// =============================================================
// GET    -> list captured payloads (for the viewer's Refresh button)
// DELETE -> clear all captures (the viewer's Clear button)
//
// This lives under /api/automations/* so it is covered by the auth proxy; it
// also checks the session itself. The PUBLIC ingest endpoint is the separate
// /api/zapier-webhook-debug/[secret] route. Delete this when done.
// =============================================================

import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { getCaptures, clearCaptures } from "@/lib/automations/webhook-debug";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const captures = await getCaptures();
  return NextResponse.json({ captures });
}

export async function DELETE() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearCaptures();
  return NextResponse.json({ ok: true });
}

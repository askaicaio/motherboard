// GET /api/automations/webhook-related — the Webhook Links "related automations"
// lookup. Given a webhook choice id, returns every automation that uses it,
// across ALL platforms (name / platform / status / link), so the dialog can
// render a cross-platform related list.
//
// Query params:
//   choiceId   (required) the webhook choice id to look up.
//   excludeId  (optional) an automation id to omit — the anchor automation in
//              the Model A "others only" flow. Omitted for the Config page
//              browse-all (which lists ALL users of the webhook).
//
// Read-only; the tables/config open it on demand (a page holds only its own
// platform's rows, so the cross-platform list must come from the server).

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { getAutomationsByWebhook } from "@/lib/automations/dropdown-selections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const choiceId = searchParams.get("choiceId");
  const excludeId = searchParams.get("excludeId");
  if (!choiceId) {
    return NextResponse.json({ error: "choiceId required" }, { status: 400 });
  }

  const all = await getAutomationsByWebhook(choiceId);
  const automations = excludeId ? all.filter((a) => a.id !== excludeId) : all;
  return NextResponse.json({ automations });
}

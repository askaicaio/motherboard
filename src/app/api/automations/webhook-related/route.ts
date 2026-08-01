// GET /api/automations/webhook-related — the Webhook Links "related automations"
// lookup. Two modes, both live (a page holds only its own platform's rows, so
// this must come from the server) and both read-only:
//
//   Counts (stage-1 badges):  ?choiceIds=a,b,c[&excludeId=X]
//     → { counts: { choiceId: othersCount } } — how many OTHER automations use
//       each webhook (excluding the anchor). Fetched when the dialog opens so
//       the badge matches the stage-2 list (a page-load count goes stale the
//       moment webhooks are edited in-session).
//
//   List (stage 2):  ?choiceId=X[&excludeId=Y]
//     → { automations: [...] } — every automation using the webhook, across ALL
//       platforms (name / platform / status / link). `excludeId` drops the
//       anchor (Model A "others only"); omit it for the Config browse-all.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import {
  getAutomationsByWebhook,
  getWebhookOthersCounts,
} from "@/lib/automations/dropdown-selections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const excludeId = searchParams.get("excludeId") ?? undefined;

  // Counts mode: per-webhook "others" counts for the stage-1 picker badges.
  const choiceIdsParam = searchParams.get("choiceIds");
  if (choiceIdsParam !== null) {
    const ids = choiceIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const counts = await getWebhookOthersCounts(ids, excludeId);
    return NextResponse.json({ counts });
  }

  // List mode: the related automations for one webhook.
  const choiceId = searchParams.get("choiceId");
  if (!choiceId) {
    return NextResponse.json({ error: "choiceId required" }, { status: 400 });
  }
  const all = await getAutomationsByWebhook(choiceId);
  const automations = excludeId ? all.filter((a) => a.id !== excludeId) : all;
  return NextResponse.json({ automations });
}

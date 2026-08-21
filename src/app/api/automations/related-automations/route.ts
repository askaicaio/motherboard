// GET /api/automations/related-automations — the "which other automations share
// this?" lookup, for ANY multi-select column. Read-only, and live: a page holds
// only its own platform's rows, while sharing is cross-platform, so this cannot
// be answered on the client.
//
// TWO SOURCES, chosen with `source`, because the columns are stored differently:
//   source=webhook   (default)  → the automation_webhooks junction, i.e. the
//                                 Webhook Links column with its own choices table
//   source=selection            → the generic automation_dropdown_selections
//                                 junction, i.e. GHL Tags (and any other
//                                 multi-select column, since choice ids are
//                                 globally unique and imply their own column)
// `webhook` is the DEFAULT so the original callers keep working unchanged.
//
// TWO MODES, chosen by which param is present:
//   Counts (stage-1 badges):  ?choiceIds=a,b,c[&excludeId=X][&source=…]
//     → { counts: { choiceId: othersCount } } — how many OTHER automations share
//       each item. Fetched when the dialog opens so the badge matches the stage-2
//       list; a page-load count goes stale the moment selections are edited.
//
//   List (stage 2):  ?choiceId=X[&excludeId=Y][&source=…]
//     → { automations: [...] } — every automation using that item, across ALL
//       platforms (name / platform / status / link). `excludeId` drops the anchor
//       (Model A "others only"); omit it for the Config-page browse-all.
//
// NOTE this route was `/webhook-related` until 2026-08-21, when GHL Tags gained
// the same lookup and the name stopped being true. Nothing external calls it.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import {
  getAutomationsByWebhook,
  getWebhookOthersCounts,
  getAutomationsBySelection,
  getSelectionOthersCounts,
} from "@/lib/automations/dropdown-selections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const excludeId = searchParams.get("excludeId") ?? undefined;
  const source = searchParams.get("source") ?? "webhook";
  if (source !== "webhook" && source !== "selection") {
    return NextResponse.json(
      { error: "source must be 'webhook' or 'selection'" },
      { status: 400 },
    );
  }
  const isWebhook = source === "webhook";

  // Counts mode: per-item "others" counts for the stage-1 picker badges.
  const choiceIdsParam = searchParams.get("choiceIds");
  if (choiceIdsParam !== null) {
    const ids = choiceIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const counts = isWebhook
      ? await getWebhookOthersCounts(ids, excludeId)
      : await getSelectionOthersCounts(ids, excludeId);
    return NextResponse.json({ counts });
  }

  // List mode: the related automations for one item.
  const choiceId = searchParams.get("choiceId");
  if (!choiceId) {
    return NextResponse.json({ error: "choiceId required" }, { status: 400 });
  }
  const all = isWebhook
    ? await getAutomationsByWebhook(choiceId)
    : await getAutomationsBySelection(choiceId);
  const automations = excludeId ? all.filter((a) => a.id !== excludeId) : all;
  return NextResponse.json({ automations });
}

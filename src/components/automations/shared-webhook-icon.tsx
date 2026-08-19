// Passive "this webhook is shared" indicator for the Webhook Links cells.
//
// Both Webhook Links tables (the Per Website table and View All Lists) render the
// same cell, so the icon and its hover text live HERE rather than being copied
// into each one. The two cells were already near-identical copies; duplicating a
// third thing across them is how they drift apart.
//
// The signal is PASSIVE by design: it answers "is this webhook connected to other
// automations" at a glance, without opening the related-automations dialog. The
// dialog still fetches its own LIVE counts and stays authoritative — these counts
// come from page load (see the staleness note on `sharedWith` below).

import { Share2 } from "lucide-react";
import type { SelectedWebhook } from "@/lib/automations/dropdown-config";

/** A webhook line's native hover text: the full URL (the cell truncates it), plus
 *  the sharing count when the webhook is shared. Kept as a plain `title` rather
 *  than a <Tooltip> to match what the cell already did for the URL; the standing
 *  tooltip audit can upgrade both together later. */
export function webhookLineTitle(w: Pick<SelectedWebhook, "url" | "sharedWith">) {
  const n = w.sharedWith ?? 0;
  if (n <= 0) return w.url;
  return `${w.url}\nShared with ${n} other automation${n === 1 ? "" : "s"}`;
}

/** Muted share glyph (one node branching to two) shown before a SHARED webhook's
 *  URL, and nothing at all when the webhook is used only by this automation.
 *
 *  COLOUR: deliberately quiet zinc-400, the same muted tone the empty-cell "-"
 *  uses. It is NOT amber: amber already means "count" in this cell (the gold
 *  `(N)`), and the two sat adjacent, so an amber icon merged with the count into
 *  one blob despite meaning something entirely different. Every other colour in
 *  the Automations tab is spoken for too — red = errors/delete, blue = URLs,
 *  emerald = Active status — so a neutral was the honest choice for a PASSIVE
 *  signal that should inform without competing.
 *
 *  SIZE: 14px, not 12px. Share2 is a 5-element glyph and muddied at 12px. The
 *  URL line box is 16px, so 14px still never grows the row.
 *
 *  aria-hidden because webhookLineTitle already carries the meaning as text. */
export function SharedWebhookIcon({ sharedWith }: { sharedWith?: number }) {
  if ((sharedWith ?? 0) <= 0) return null;
  return (
    <Share2
      aria-hidden
      className="mr-1 inline h-3.5 w-3.5 align-[-3px] text-zinc-400"
    />
  );
}

/** Sort rank for the Webhook Links column, shared by both tables so the two
 *  cannot drift:
 *    0 = has at least one SHARED webhook
 *    1 = has webhooks, none shared
 *    2 = no webhooks at all
 *
 *  Deliberately does NOT rank by HOW MANY webhooks are shared: this is a
 *  group toggle, so ties fall through and (because Array#sort is stable and rows
 *  arrive name-ascending) keep their alphabetical order. */
export function webhookSortRank(row: {
  webhooks?: Pick<SelectedWebhook, "sharedWith">[];
}): 0 | 1 | 2 {
  const list = row.webhooks ?? [];
  if (list.length === 0) return 2;
  return list.some((w) => (w.sharedWith ?? 0) > 0) ? 0 : 1;
}

/** Comparator body for the Webhook Links column. `dir` is 1 for asc, -1 for desc.
 *
 *    asc   shared  ->  webhooks-but-unshared  ->  no webhooks
 *    desc  no webhooks  ->  webhooks-but-unshared  ->  shared
 *
 *  ⚠️ This column REVERSES COMPLETELY, on purpose (user-specified 2026-08-19).
 *  It INTENTIONALLY BREAKS the blanks-last rule that the date columns and Author
 *  follow, where empties stay pinned to the bottom in both directions. Do NOT
 *  "fix" this back to that convention: here the empty tier is a meaningful third
 *  group ("no links"), not a missing value, so the user wants it to travel with
 *  the flip. That is why there is no special case for rank 2 below. */
export function compareWebhookShared(
  a: { webhooks?: Pick<SelectedWebhook, "sharedWith">[] },
  b: { webhooks?: Pick<SelectedWebhook, "sharedWith">[] },
  dir: number,
): number {
  return dir * (webhookSortRank(a) - webhookSortRank(b));
}

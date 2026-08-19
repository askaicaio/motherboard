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

import { Link2 } from "lucide-react";
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

/** Amber chain-link glyph shown before a SHARED webhook's URL (and nothing at all
 *  when the webhook is used only by this automation). 12px to match the text-xs
 *  URL line, so it never grows the row. Amber matches the cell's existing count
 *  colour, keeping "meta about the webhooks" visually distinct from the blue
 *  clickable URLs. aria-hidden because webhookLineTitle already carries the
 *  meaning in text. */
export function SharedWebhookIcon({ sharedWith }: { sharedWith?: number }) {
  if ((sharedWith ?? 0) <= 0) return null;
  return (
    <Link2
      aria-hidden
      className="mr-1 inline h-3 w-3 align-[-2px] text-amber-600"
    />
  );
}

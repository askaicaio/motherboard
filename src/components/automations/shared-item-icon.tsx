// Passive "this value is shared with other automations" indicator, plus the sort
// helpers that go with it. Used by the Webhook Links cells and the GHL Tags
// cells, on BOTH the Per Website table and View All Lists.
//
// All four surfaces render the same thing, so the icon, its hover text and the
// comparator live HERE rather than being copied into each one. They were already
// near-identical copies; duplicating a fifth thing across them is how they drift.
//
// The signal is PASSIVE by design: it answers "is this connected to other
// automations" at a glance, without opening the related-automations dialog. The
// dialog still fetches its own LIVE counts and stays authoritative; these come
// from page load (see the staleness note on `sharedWith`).
//
// NOTE this file was `shared-webhook-icon.tsx` until 2026-08-21, when GHL Tags
// gained the same lookup and nothing here was webhook-specific any more.

import { Share2 } from "lucide-react";

/** A cell line's native hover text: the full value (cells truncate), plus the
 *  sharing count when it is shared. `noun` names what is shared, so the sentence
 *  reads "Shared with 2 other automations" for either column.
 *
 *  Kept as a plain `title` rather than a <Tooltip> to match what the cells
 *  already did; the standing tooltip audit can upgrade them together later. */
export function sharedItemTitle(value: string, sharedWith?: number): string {
  const n = sharedWith ?? 0;
  if (n <= 0) return value;
  return `${value}\nShared with ${n} other automation${n === 1 ? "" : "s"}`;
}

/** Muted share glyph (one node branching to two) shown before a SHARED value,
 *  and nothing at all when only this automation uses it.
 *
 *  COLOUR: deliberately quiet zinc-400, the same muted tone the empty-cell "-"
 *  uses. It is NOT amber: amber already means "count" in these cells (the gold
 *  `(N)`), and the two sit adjacent, so an amber icon merged with the count into
 *  one blob despite meaning something entirely different. Every other colour in
 *  the Automations tab is spoken for too: red = errors/delete, blue = URLs,
 *  emerald = Active status. A neutral was the honest choice for a PASSIVE signal
 *  that should inform without competing.
 *
 *  SIZE: 14px, not 12px. Share2 is a 5-element glyph and muddied at 12px. The
 *  line box is 16px, so 14px still never grows the row.
 *
 *  aria-hidden because sharedItemTitle already carries the meaning as text. */
export function SharedItemIcon({ sharedWith }: { sharedWith?: number }) {
  if ((sharedWith ?? 0) <= 0) return null;
  return (
    <Share2
      aria-hidden
      className="mr-1 inline h-3.5 w-3.5 align-[-3px] text-zinc-400"
    />
  );
}

/** Sort rank for a cell holding a list of possibly-shared values:
 *    0 = has at least one SHARED value
 *    1 = has values, none shared
 *    2 = empty cell
 *
 *  Tier 2 is handled by the CALLER, which always sinks it to the bottom
 *  regardless of sort direction, the same blanks-last rule the date columns and
 *  Author use. Tiers 0 and 1 swap on direction, matching the Status column's
 *  grouping-toggle behaviour rather than a true ordering.
 *
 *  Deliberately does NOT rank by HOW MANY are shared: this is a two-group toggle
 *  like Status, so ties fall through and (because Array#sort is stable and rows
 *  arrive name-ascending) keep their alphabetical order. */
export function sharedSortRank(
  list: { sharedWith?: number }[] | undefined,
): 0 | 1 | 2 {
  const items = list ?? [];
  if (items.length === 0) return 2;
  return items.some((w) => (w.sharedWith ?? 0) > 0) ? 0 : 1;
}

/** Comparator body for a shared-value column. `dir` is 1 for asc, -1 for desc.
 *
 *    asc   shared  ->  present-but-unshared  ->  empty
 *    desc  present-but-unshared  ->  shared  ->  empty
 *
 *  Empty cells always finish last, in BOTH directions, the same blanks-last rule
 *  the date columns and Author follow.
 *
 *  SETTLED, do not flip again: a full reversal (empty tier rising to the top on
 *  desc) was tried and reverted at the user's request on 2026-08-19. Keeping the
 *  empty tier pinned means the two groups you actually care about stay adjacent
 *  to the top in both directions, instead of a wall of empty rows landing there. */
export function compareShared(
  a: { sharedWith?: number }[] | undefined,
  b: { sharedWith?: number }[] | undefined,
  dir: number,
): number {
  const ra = sharedSortRank(a);
  const rb = sharedSortRank(b);
  if (ra === 2 && rb === 2) return 0;
  if (ra === 2) return 1;
  if (rb === 2) return -1;
  return dir * (ra - rb);
}

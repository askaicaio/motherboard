"use client";

// The "related automations" lookup dialog, shared by EVERY multi-select column
// that can be shared between automations. Opened from the gold count in a cell
// (anchored to that automation) or from a Config page Relationships count
// (browse-all). Two stages in one modal:
//
//   Stage 1 (pick a webhook): only when the target has MORE THAN ONE webhook.
//     Lists them, each with a "shared with N other automations" badge. A single
//     webhook auto-skips straight to stage 2.
//   Stage 2 (related list): fetches every OTHER automation using the chosen
//     webhook (Model A "others only" when anchored; ALL users for browse-all),
//     across all platforms. Header line gives the webhook + anchor context.
//
// Read-only. The cross-platform list is fetched on demand from
// /api/automations/related-automations (a page holds only its own platform's
// rows, while sharing spans platforms).
//
// ⚠️ ONE DIALOG, MANY COLUMNS. What differs per column is (a) which junction
// backs it and (b) the WORDS, so both live in KINDS below and nothing else in
// here is column-aware. Adding another column = one KINDS entry. Was
// webhook-only until 2026-08-21, when GHL Tags gained the same lookup.
//
// ⚠️ WEBHOOK BEHAVIOUR MUST NOT DRIFT: its copy, its monospace font and its
// click-to-copy are all preserved exactly by the `webhook` KINDS entry. If you
// change shared markup here, re-check the Webhook Links lookup too.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAutomationSite } from "@/lib/automations/sites";
import type { RelatedAutomation } from "@/lib/automations/dropdown-config";

/** Copy the chosen value to the clipboard with a toast. Used for the webhook
 *  URL, which is click-to-copy rather than a navigable link. */
async function copyValue(value: string, nounLabel: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${nounLabel} link copied`);
  } catch {
    toast.error("Could not copy link");
  }
}

/** Which column's lookup this is. Drives the API source and every noun on
 *  screen; see KINDS. */
export type RelatedLookupKind = "webhook" | "ghlTag";

/** Per-column wording + rendering. The ONLY column-aware thing in this file.
 *
 *  `mono`/`copyable` exist because a webhook VALUE is a long URL (monospace,
 *  click-to-copy, since it is not navigable) whereas a tag value is a short
 *  human label, where both would look wrong. */
const KINDS: Record<
  RelatedLookupKind,
  {
    /** Lower-case singular, used mid-sentence ("...use this webhook."). */
    noun: string;
    /** Sentence-start plural ("Webhooks on X."). */
    nounPlural: string;
    /** Sentence-start singular, labelling the chosen value ("Webhook: ..."). */
    nounLabel: string;
    /** Which junction backs it, passed to the API as `source`. */
    source: "webhook" | "selection";
    /** Render the value in monospace (long machine strings only). */
    mono: boolean;
    /** Make the value click-to-copy rather than plain text. */
    copyable: boolean;
  }
> = {
  webhook: {
    noun: "webhook",
    nounPlural: "Webhooks",
    nounLabel: "Webhook",
    source: "webhook",
    mono: true,
    copyable: true,
  },
  ghlTag: {
    noun: "GHL tag",
    nounPlural: "GHL tags",
    nounLabel: "GHL tag",
    source: "selection",
    mono: false,
    copyable: false,
  },
};

/** What the dialog was opened for. `anchor` present → anchored flow (exclude
 *  that automation, show "on <name>" context); null → Config browse-all (all
 *  users, no exclusion). `items` is the choose-from set (one → skip stage 1),
 *  each with the display `label` for that column (a URL for webhooks, a tag
 *  name for GHL Tags).
 *  The stage-1 "shared with N others" counts are fetched live on open (see
 *  below), NOT carried here, so they can't go stale after an in-session edit. */
export interface RelatedLookupTarget {
  kind: RelatedLookupKind;
  anchor: { id: string; name: string; platform: string } | null;
  items: { id: string; label: string }[];
}

function platformLabel(slug: string): string {
  return getAutomationSite(slug)?.label ?? slug;
}

/** Where a related row goes: that automation's Motherboard Per Website page,
 *  with the search box pre-filled with its NAME so the row is the only thing on
 *  screen. The page reads `?q=` server-side (see its searchParams handling).
 *
 *  WHY NOT the automation's own website: the point of this list is usually "what
 *  else in OUR records touches this", so landing in the Motherboard keeps you in
 *  the tool. The source-platform link is still one click away, on the
 *  ExternalLink glyph at the right of the row. */
function motherboardHref(a: RelatedAutomation): string {
  return `/automations/${a.platform}?q=${encodeURIComponent(a.name)}`;
}

export function RelatedAutomationsDialog({
  target,
  onOpenChange,
}: {
  target: RelatedLookupTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  const items = target?.items ?? [];
  const multi = items.length > 1;
  // Wording + rendering for this column. Falls back to webhook when closed, so
  // the render path never has to null-check it.
  const kind = KINDS[target?.kind ?? "webhook"];

  // The chosen webhook (stage 2). A single-webhook target auto-picks it so the
  // stage-1 picker is skipped.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [list, setList] = useState<RelatedAutomation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Per-webhook "others" counts for the stage-1 badges, fetched live on open
  // (null = still loading). Keyed by webhook choice id.
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  // Reset when opened for a different target (row / webhook).
  useEffect(() => {
    if (!target) return;
    setPickedId(target.items.length === 1 ? target.items[0].id : null);
    setList(null);
    setError(false);
  }, [target]);

  // Fetch the stage-1 "shared with N others" counts live when the dialog opens.
  // Only the multi-webhook picker shows them; a single webhook skips stage 1.
  // Excludes the anchor automation so the badge matches the stage-2 list.
  useEffect(() => {
    if (!target || target.items.length <= 1) {
      setCounts({});
      return;
    }
    let cancelled = false;
    setCounts(null);
    const params = new URLSearchParams({
      choiceIds: target.items.map((w) => w.id).join(","),
      source: KINDS[target.kind].source,
    });
    if (target.anchor) params.set("excludeId", target.anchor.id);
    fetch(`/api/automations/related-automations?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setCounts((data.counts ?? {}) as Record<string, number>);
      })
      .catch(() => {
        // Fall back to an empty map (badges read 0); stage 2 is still accurate.
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Fetch the related automations for the chosen webhook.
  useEffect(() => {
    if (!pickedId || !target) return;
    const excludeId = target.anchor?.id;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setList(null);
    const params = new URLSearchParams({
      choiceId: pickedId,
      source: KINDS[target.kind].source,
    });
    if (excludeId) params.set("excludeId", excludeId);
    fetch(`/api/automations/related-automations?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setList(data.automations as RelatedAutomation[]);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickedId, target]);

  const picked = items.find((w) => w.id === pickedId) ?? null;
  const anchor = target?.anchor ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Related automations</DialogTitle>
        </DialogHeader>

        {multi && pickedId === null ? (
          /* Stage 1: pick which webhook to explore. */
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 text-sm text-zinc-500">
              {anchor
                ? `${kind.nounPlural} on ${anchor.name}. Pick one to see the automations that share it.`
                : `Pick a ${kind.noun} to see the automations that use it.`}
            </p>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {items.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setPickedId(w.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    {/* Full value, wrapping across lines rather than truncating
                        (overflow-wrap:anywhere breaks a long unbroken token like
                        a URL so the whole thing is visible on the narrow dialog).
                        Monospace only for machine strings; see KINDS.mono. */}
                    <span
                      className={cn(
                        "min-w-0 flex-1 [overflow-wrap:anywhere] text-xs text-blue-600",
                        kind.mono && "font-mono",
                      )}
                    >
                      {w.label}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500">
                      {counts === null
                        ? "Checking…"
                        : `Shared with ${counts[w.id] ?? 0} other${
                            (counts[w.id] ?? 0) === 1 ? "" : "s"
                          }`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          /* Stage 2: the related automations for the chosen webhook. */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 shrink-0">
              {multi && (
                <button
                  type="button"
                  onClick={() => setPickedId(null)}
                  className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All {kind.nounPlural.toLowerCase()}
                </button>
              )}
              {/* Anchor context on its own line (anchored flow only). */}
              {anchor && (
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">{anchor.name}</span>
                  <span className="text-zinc-400">
                    {" · "}
                    {platformLabel(anchor.platform)}
                  </span>
                </p>
              )}
              {/* The chosen value. Copyable columns (a webhook URL, which is not
                  navigable) render a click-to-copy button; the rest render plain
                  text, since a short tag name has nothing worth copying. */}
              <p className="mt-0.5 text-sm text-zinc-700">
                {kind.nounLabel}:{" "}
                {picked &&
                  (kind.copyable ? (
                    <button
                      type="button"
                      onClick={() => copyValue(picked.label, kind.nounLabel)}
                      title="Click to copy"
                      className={cn(
                        "cursor-pointer break-all text-left text-xs text-blue-600 hover:underline",
                        kind.mono && "font-mono",
                      )}
                    >
                      {picked.label}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "break-all text-xs text-zinc-900",
                        kind.mono && "font-mono",
                      )}
                    >
                      {picked.label}
                    </span>
                  ))}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-zinc-400">Loading…</p>
              ) : error ? (
                <p className="text-sm text-red-600">
                  Could not load related automations. Please try again.
                </p>
              ) : list && list.length > 0 ? (
                <ul className="space-y-1">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-stretch gap-2">
                      {/* TWO SEPARATE BUTTONS, side by side, because they go to
                          DIFFERENT places: the wide one into the Motherboard, the
                          narrow one out to the source platform. They have to be
                          SIBLINGS anyway (nesting an <a> in an <a> is invalid
                          HTML), but they are now visually separate too, because
                          the glyph sitting inside the row's own border did not
                          read as clickable (user, 2026-08-22).

                          items-stretch on the <li> is what makes the narrow
                          button match the wide one's height: ONLY the wide one
                          sets vertical padding and the narrow one stretches to
                          it. Do not give the narrow one its own py, or the two
                          drift apart whenever the wide one's content reflows. */}
                      <a
                        href={motherboardHref(a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open "${a.name}" in the Motherboard`}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50"
                      >
                        <span className="min-w-0">
                          {/* WRAPS, does not truncate: the full name matters more
                              than a tidy single line here, since this list is how
                              you identify which automation to open.

                              ⚠️ [overflow-wrap:anywhere], NOT break-words. A name
                              can be one long unbroken token (a test row named
                              "testtesttest..." is what surfaced this), and
                              break-words does not shrink the element's min-content
                              width, so the button would stretch instead of
                              wrapping. This is a recurring trap in this codebase.
                              min-w-0 on this span is the other half: without it
                              the flex child refuses to shrink at all. */}
                          <span className="block text-sm text-zinc-900 [overflow-wrap:anywhere]">
                            {a.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {platformLabel(a.platform)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            a.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-zinc-100 text-zinc-700",
                          )}
                        >
                          {a.status === "active" ? "Active" : "Paused"}
                        </span>
                      </a>
                      {/* BLUE because blue-600 is what every other "this opens a
                          URL" affordance in the Automations tab uses, and this is
                          the one of the two that leaves the Motherboard. */}
                      <a
                        href={a.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open on ${platformLabel(a.platform)}`}
                        className="flex shrink-0 items-center justify-center rounded-md border border-zinc-200 px-3 text-blue-600 transition-colors hover:bg-zinc-50 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {anchor
                    ? `No other automations use this ${kind.noun}.`
                    : `No automations use this ${kind.noun}.`}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

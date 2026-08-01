"use client";

// The Webhook Links "related automations" lookup dialog. Opened from the gold
// count in a Webhook Links cell (anchored to that automation) or from the
// Config page Relationships count (browse-all). Two stages in one modal:
//
//   Stage 1 (pick a webhook): only when the target has MORE THAN ONE webhook.
//     Lists them, each with a "shared with N other automations" badge. A single
//     webhook auto-skips straight to stage 2.
//   Stage 2 (related list): fetches every OTHER automation using the chosen
//     webhook (Model A "others only" when anchored; ALL users for browse-all),
//     across all platforms. Header line gives the webhook + anchor context.
//
// Read-only. The cross-platform list is fetched on demand from
// /api/automations/webhook-related (a page holds only its own platform's rows).

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAutomationSite } from "@/lib/automations/sites";
import type { RelatedAutomation } from "@/lib/automations/dropdown-config";

/** What the dialog was opened for. `anchor` present → anchored flow (exclude
 *  that automation, show "on <name>" context); null → Config browse-all (all
 *  users, no exclusion). `webhooks` is the choose-from set (one → skip stage 1).
 *  The stage-1 "shared with N others" counts are fetched live on open (see
 *  below), NOT carried here, so they can't go stale after an in-session edit. */
export interface WebhookLookupTarget {
  anchor: { id: string; name: string; platform: string } | null;
  webhooks: { id: string; url: string }[];
}

function platformLabel(slug: string): string {
  return getAutomationSite(slug)?.label ?? slug;
}

export function WebhookRelatedDialog({
  target,
  onOpenChange,
}: {
  target: WebhookLookupTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  const webhooks = target?.webhooks ?? [];
  const multi = webhooks.length > 1;

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
    setPickedId(target.webhooks.length === 1 ? target.webhooks[0].id : null);
    setList(null);
    setError(false);
  }, [target]);

  // Fetch the stage-1 "shared with N others" counts live when the dialog opens.
  // Only the multi-webhook picker shows them; a single webhook skips stage 1.
  // Excludes the anchor automation so the badge matches the stage-2 list.
  useEffect(() => {
    if (!target || target.webhooks.length <= 1) {
      setCounts({});
      return;
    }
    let cancelled = false;
    setCounts(null);
    const params = new URLSearchParams({
      choiceIds: target.webhooks.map((w) => w.id).join(","),
    });
    if (target.anchor) params.set("excludeId", target.anchor.id);
    fetch(`/api/automations/webhook-related?${params.toString()}`)
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
    const params = new URLSearchParams({ choiceId: pickedId });
    if (excludeId) params.set("excludeId", excludeId);
    fetch(`/api/automations/webhook-related?${params.toString()}`)
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

  const picked = webhooks.find((w) => w.id === pickedId) ?? null;
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
                ? `Webhooks on ${anchor.name}. Pick one to see the automations that share it.`
                : "Pick a webhook to see the automations that use it."}
            </p>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {webhooks.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setPickedId(w.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-700"
                      title={w.url}
                    >
                      {w.url}
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
                  All webhooks
                </button>
              )}
              <p className="text-sm text-zinc-700">
                Webhook{" "}
                <span
                  className="break-all font-mono text-xs text-zinc-900"
                  title={picked?.url}
                >
                  {picked?.url}
                </span>
                {anchor && (
                  <>
                    {" "}
                    on <span className="font-medium">{anchor.name}</span>
                    <span className="text-zinc-400">
                      {" · "}
                      {platformLabel(anchor.platform)}
                    </span>
                  </>
                )}
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
                    <li key={a.id}>
                      <a
                        href={a.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-zinc-900">
                            {a.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {platformLabel(a.platform)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                              a.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700",
                            )}
                          >
                            {a.status === "active" ? "Active" : "Paused"}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {anchor
                    ? "No other automations use this webhook."
                    : "No automations use this webhook."}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

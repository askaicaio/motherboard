"use client";

// Shared verification checklist for the affiliate testing guide. Every staff
// member has their OWN checkmarks (an item is "checked" only for the people who
// ticked it), but everyone can see which teammates have approved each item via
// the avatars on the right. "Reset" clears only the current user's ticks.
// Backed by /api/partner-program/checklist.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, RotateCcw, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { id: string; label: string }[] }[] = [
  {
    title: "Apply & approve",
    items: [
      { id: "landing", label: "Landing page loads and looks right" },
      { id: "apply", label: "Apply form submits successfully" },
      { id: "confirm-email", label: "Applicant receives the confirmation email" },
      { id: "app-shows", label: "Application appears in Motherboard → Applications" },
      { id: "approve", label: "Approve works and the affiliate gets the approval email" },
      { id: "decline", label: "Decline works and the applicant gets the decline email (with reason)" },
    ],
  },
  {
    title: "Portal & payout setup",
    items: [
      { id: "signin", label: "Affiliate can sign in to the portal" },
      { id: "connect", label: "“Connect payout account” (Stripe) completes → status shows Ready" },
      { id: "taxform", label: "Tax-form type + PDF upload works" },
      { id: "profile", label: "Affiliate can edit their address on the Profile page" },
    ],
  },
  {
    title: "Referral tracking (all report to Motherboard)",
    items: [
      { id: "ref-redirect", label: "Referral link redirects with aff_id + utm_content" },
      { id: "booking", label: "Booking → GHL → lead shows in Activity → Attribution" },
      { id: "purchase", label: "Buy now (/enroll) → Stripe → conversion recorded in Activity" },
      { id: "assessment", label: "Assessment flow → lead captured" },
    ],
  },
  {
    title: "Commission & payout",
    items: [
      { id: "pending", label: "New conversion shows in Activity as Pending" },
      { id: "earned", label: "“Mark earned” moves it to Earned" },
      { id: "batch", label: "Generate payout batch includes the affiliate" },
      { id: "paid", label: "Mark paid → affiliate sees it in their portal Payouts" },
    ],
  },
  {
    title: "Notifications",
    items: [
      { id: "notif-app", label: "Subscribed staff get notified of a new application" },
      { id: "notif-msg", label: "Subscribed staff get notified of a new affiliate message" },
    ],
  },
];

const ALL_IDS = GROUPS.flatMap((g) => g.items.map((i) => i.id));

interface Approver {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function LaunchChecklist() {
  const [approvals, setApprovals] = useState<Record<string, Approver[]>>({});
  const [me, setMe] = useState<Approver | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner-program/checklist", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setApprovals(data.approvals ?? {});
      setMe(data.currentUser ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myChecked = useCallback(
    (itemId: string) =>
      !!me && (approvals[itemId] ?? []).some((a) => a.userId === me.userId),
    [approvals, me],
  );

  function toggle(itemId: string) {
    if (!me) return;
    const mine = myChecked(itemId);
    // Optimistic
    setApprovals((prev) => {
      const cur = prev[itemId] ?? [];
      return {
        ...prev,
        [itemId]: mine
          ? cur.filter((a) => a.userId !== me.userId)
          : [...cur, me],
      };
    });
    fetch("/api/partner-program/checklist", {
      method: mine ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    }).then((r) => {
      if (!r.ok) load();
    });
  }

  function reset() {
    if (!me) return;
    setApprovals((prev) => {
      const next: Record<string, Approver[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter((a) => a.userId !== me.userId);
      }
      return next;
    });
    fetch("/api/partner-program/checklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).then((r) => {
      if (!r.ok) load();
    });
  }

  const doneCount = useMemo(
    () => ALL_IDS.filter((id) => myChecked(id)).length,
    [myChecked],
  );
  const total = ALL_IDS.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Verification checklist
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tick items as <span className="font-medium">you</span> verify them.
            Avatars on the right show which teammates have approved each one.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tabular-nums text-zinc-600">
            {doneCount}/{total} done
          </span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset mine
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isChecked = myChecked(item.id);
                  const approvers = approvals[item.id] ?? [];
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                      >
                        {isChecked ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            isChecked
                              ? "text-zinc-400 line-through"
                              : "text-zinc-700",
                          )}
                        >
                          {item.label}
                        </span>
                      </button>

                      {/* Approver avatars (everyone who ticked it) */}
                      {approvers.length > 0 && (
                        <div
                          className="flex shrink-0 -space-x-1.5"
                          title={`Approved by: ${approvers.map((a) => a.name).join(", ")}`}
                        >
                          {approvers.slice(0, 5).map((a) => (
                            <Avatar
                              key={a.userId}
                              className="h-5 w-5 ring-2 ring-white"
                            >
                              <AvatarImage src={a.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-[8px]">
                                {initials(a.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {approvers.length > 5 && (
                            <span className="flex h-5 items-center rounded-full bg-zinc-100 px-1.5 text-[9px] font-semibold text-zinc-500 ring-2 ring-white">
                              +{approvers.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

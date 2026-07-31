"use client";

// Interactive "have we verified this?" checklist for the affiliate testing guide.
// Each person's ticks are saved in their own browser (localStorage) so they can
// track their own sign-off as they work through the guide. (Not shared across
// users — see note in the guide; can be upgraded to a DB-backed team sign-off.)

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "caio.affiliate-testing-checklist.v1";

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

export function LaunchChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, loaded]);

  const doneCount = ALL_IDS.filter((id) => checked[id]).length;
  const total = ALL_IDS.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Verification checklist
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tick each item as you verify it. Saved in your browser, so your
            progress sticks between visits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tabular-nums text-zinc-600">
            {doneCount}/{total} done
          </span>
          <button
            type="button"
            onClick={() => setChecked({})}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-5 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isChecked = !!checked[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-50"
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
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

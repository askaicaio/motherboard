"use client";

// Feature Integration Alpha7's client: the website rail and its detail panel.
// =============================================================
// ⚠️ THE ONLY CLIENT COMPONENT among the eight Feature Integration benches,
// because it is the only one where something is SELECTED. The other seven
// render everything at once and stay server components.
//
// ⚠️ IT RECEIVES THE SAVED STATE AS A PROP and never fetches or writes. The
// live page's checkbox toggling is disabled (TOGGLE_ENABLED), so a bench that
// wrote would be doing something the real page cannot.
// =============================================================

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteIcon } from "@/components/automations/site-icon";
import {
  FEATURE_INTEGRATION_TABLES,
  cellKey,
} from "@/lib/automations/feature-integration-spec";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { cn } from "@/lib/utils";

export function FeatureIntegrationAlpha7Client({
  state,
}: {
  state: Record<string, boolean>;
}) {
  // ⭐ THE DEFAULT IS THE FIRST WEBSITE, WHICH IS ALSO THE BEST-COVERED ONE
  // TODAY. Landing on a fully green panel would be a poor advert for a page
  // about gaps, so the rail prints every website's score next to it: the panel
  // shows one, the rail shows all five, and neither hides the other.
  const [slug, setSlug] = useState<string>(AUTOMATION_SITES[0].slug);
  const site =
    AUTOMATION_SITES.find((s) => s.slug === slug) ?? AUTOMATION_SITES[0];

  const on = (tableId: string, rowKey: string, s: string) =>
    !!state[cellKey(tableId, rowKey, s)];

  const total = FEATURE_INTEGRATION_TABLES.reduce(
    (n, t) => n + t.rows.length,
    0,
  );
  const score = (s: string) =>
    FEATURE_INTEGRATION_TABLES.reduce(
      (n, t) => n + t.rows.filter((r) => on(t.id, r.key, s)).length,
      0,
    );

  const hits = score(site.slug);
  const pct = Math.round((hits / total) * 100);

  return (
    <div className="flex items-start gap-4">
      {/* The rail. `shrink-0` at a fixed width is what takes navigation out of
          the width calculation; the panel beside it is the flexible one. */}
      <nav aria-label="Automation websites" className="w-60 shrink-0 space-y-1">
        {AUTOMATION_SITES.map((s) => {
          const n = score(s.slug);
          const active = s.slug === site.slug;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSlug(s.slug)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
              )}
            >
              <SiteIcon
                icon={s.icon}
                iconColor={s.iconColor}
                className="h-4 w-4"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {s.label}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-white/15 text-white"
                    : n === 0
                      ? "bg-red-100 text-red-700"
                      : n === total
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-200 text-zinc-700",
                )}
              >
                {n}/{total}
              </span>
            </button>
          );
        })}
      </nav>

      <Card className="min-w-0 flex-1">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b bg-zinc-50 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SiteIcon
                  icon={site.icon}
                  iconColor={site.iconColor}
                  className="h-6 w-6"
                />
                <h2 className="truncate text-lg font-semibold text-zinc-900">
                  {site.label}
                </h2>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{site.description}</p>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums text-zinc-900">
                {hits} of {total}
              </div>
              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    hits === 0 ? "bg-red-500" : "bg-green-600",
                  )}
                  style={{ width: pct + "%" }}
                />
              </div>
              {/* ⭐ THE LINK THE LIVE PAGE DOES NOT HAVE. Once a website is the
                  subject rather than a column, its own page is the next click. */}
              <Link
                href={"/automations/" + site.slug}
                className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
              >
                Open {site.label}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="divide-y">
            {FEATURE_INTEGRATION_TABLES.map((table) => {
              const n = table.rows.filter((r) =>
                on(table.id, r.key, site.slug),
              ).length;
              return (
                <div key={table.id} className="@container px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {table.cornerLabel}
                    </h3>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {n} of {table.rows.length}
                    </span>
                  </div>
                  {/* ⚠️ A CONTAINER QUERY, NOT `sm:`. This page has a width
                      floor and scrolls sideways, and **a viewport breakpoint
                      asks the window, which has no idea the page now keeps its
                      own width.** Same trap the 2026-09-23 narrow-window pass
                      had to fix across this tab. */}
                  <ul className="mt-2 grid gap-1.5 @min-[420px]:grid-cols-2">
                    {table.rows.map((row) => {
                      const yes = on(table.id, row.key, site.slug);
                      return (
                        <li key={row.key} className="flex items-center gap-2">
                          <span
                            role="img"
                            aria-label={
                              row.label +
                              ": " +
                              (yes ? "supported" : "not supported")
                            }
                            className={cn(
                              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white",
                              yes ? "bg-green-600" : "bg-red-600",
                            )}
                          >
                            {yes ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm",
                              yes ? "text-zinc-700" : "text-zinc-400",
                            )}
                          >
                            {row.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

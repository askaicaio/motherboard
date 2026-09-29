// =============================================================
// Feature Integration "Alpha4", route /automations-feature-integration-alpha4
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **written
// documentation, with a reason under every gap**. One of eight created
// together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS, AND WHY IT IS THE ODD ONE OUT. The page's own subtitle
// now says it is "a documentation of hidden features for the Automations tab"
// (2026-09-28). **A grid of forty ticks is not documentation.** It says what
// is supported and never says what the feature IS, where it shows up in the
// app, or why a red mark is red. This bench takes the subtitle at its word:
// each capability group gets a paragraph, a support strip, and the reason
// behind each website that cannot do it.
//
// 🛑🛑 THE PROSE AND THE REASONS BELOW ARE NEW COPY, WRITTEN 2026-09-29, AND
// HAVE NOT BEEN THROUGH THE USER. Every claim comes from what the build
// actually established (GHL's Workflows API has no executions endpoint;
// Zapier's list-Zaps API is gated behind publishing a public integration),
// **but the wording is mine and the user has not approved it.** If this
// layout is picked, the copy needs a read before it ships anywhere.
// ⚠️ DO NOT COPY THESE STRINGS ONTO THE LIVE PAGE on the strength of this
// file existing.
//
// ⚠️ THE MARKS READ THE SAME STORED STATE as the live page. Nothing writes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, ScrollText, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteIcon } from "@/components/automations/site-icon";
import { VersionTile } from "@/components/automations/version-tile";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import {
  FEATURE_INTEGRATION_TABLES,
  cellKey,
} from "@/lib/automations/feature-integration-spec";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { AUTOMATION_FEATURE_INTEGRATION_VERSIONS } from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SELF = "/automations-feature-integration-alpha4";

/** What each capability group actually is, in the app, in one paragraph.
 *  🛑 NEW COPY, NOT YET REVIEWED. See the header. */
const GROUP_BLURB: Record<string, string> = {
  refresh:
    "Reads each automation back from the website that owns it, so the table stops being a document someone has to maintain by hand. It runs behind the Refresh List button on a Per Website page and again on the silent 24 hour auto refresh, and it is what keeps the name, link, status, last edited date and last runtime honest.",
  error:
    "Records one row per failed run, pulled from the source website rather than typed in. It is what fills the Error History page, the Last Error column on the table, and the error counts on the hub, and it is the only part of this tab that tells you something went wrong without anyone looking.",
};

/** Why a website sits where it does. Keyed `<tableId>:<slug>`.
 *  🛑 NEW COPY, NOT YET REVIEWED. Each of these is a real finding from the
 *  build, but the sentence is mine. */
const REASON: Record<string, string> = {
  "refresh:make": "Make's REST API lists scenarios and their detail directly.",
  "refresh:n8n": "n8n's public API lists workflows and their detail directly.",
  "refresh:ghl": "GoHighLevel's Workflows API covers list and detail.",
  "refresh:ghl-b2b": "Same API as GHL, on the second subaccount's token.",
  "refresh:zapier":
    "Zapier's list-Zaps API exists but is gated behind publishing a public integration plus OAuth2, which this project is not taking on. Zapier rows come from a CSV import instead, and that import is re-runnable.",
  "error:make":
    "Make exposes per-scenario logs filterable to failures, plus a dead letter queue. The strongest error source of the five.",
  "error:n8n":
    "n8n lists executions filtered to errors, and each one carries the message and the failing node.",
  "error:ghl":
    "Confirmed impossible, not merely unbuilt. The Workflows API is list and detail only: there is no executions endpoint, no workflow-errored trigger or webhook, and the rich execution logs exist only in the GoHighLevel UI. The one external signal is a throttled, unstructured admin email.",
  "error:ghl-b2b":
    "Same dead end as GHL, and for the same reason: it is the API that is missing, not the access.",
  "error:zapier":
    "Out of scope rather than impossible. There is no Zap-free error API, though a monitor Zap's New Zap Error webhook was confirmed to deliver the failing Zap's id and message.",
};

function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label + ": " + (on ? "supported" : "not supported")}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white",
        on ? "bg-green-600" : "bg-red-600",
      )}
    >
      {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    </span>
  );
}

export default async function FeatureIntegrationAlpha4Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  return (
    <div className="@container space-y-6 p-6">
      <Link
        href="/automations/feature-integration"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Feature Integration
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ScrollText className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations Feature Integration
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha4
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Written documentation. Each capability gets a paragraph, a support
          strip, and the reason behind every website that cannot do it.
        </p>
      </div>

      {/* 🛑 THE NOTICE STAYS WHILE THE COPY IS UNREVIEWED. It is the honest
          difference between this bench and the others: the rest rearrange
          facts the user already approved, this one adds new sentences. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong className="font-semibold">Draft copy.</strong> The paragraphs
        and the reasons on this page were written for this bench and have not
        been reviewed. The marks are the real saved ones.
      </div>

      <div className="space-y-6">
        {FEATURE_INTEGRATION_TABLES.map((table) => {
          const supported = AUTOMATION_SITES.filter((s) =>
            table.rows.some((r) => on(table.id, r.key, s.slug)),
          );
          const missing = AUTOMATION_SITES.filter(
            (s) => !supported.includes(s),
          );
          return (
            <Card key={table.id}>
              <CardContent className="p-0">
                <div className="border-b bg-zinc-50 px-4 py-3">
                  <h2 className="text-base font-semibold text-zinc-900">
                    {table.cornerLabel}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-600">
                    {GROUP_BLURB[table.id]}
                  </p>
                </div>

                {/* The support strip: one chip per website, per field. Read
                    across a chip and you have that website's whole answer for
                    this feature without leaving the paragraph above. */}
                <div className="divide-y">
                  {AUTOMATION_SITES.map((site) => {
                    const reason = REASON[table.id + ":" + site.slug];
                    const hits = table.rows.filter((r) =>
                      on(table.id, r.key, site.slug),
                    ).length;
                    return (
                      <div
                        key={site.slug}
                        className="flex flex-col gap-2 px-4 py-3 @min-[720px]:flex-row @min-[720px]:items-start @min-[720px]:gap-6"
                      >
                        <div className="flex shrink-0 items-center gap-2 @min-[720px]:w-40">
                          <SiteIcon
                            icon={site.icon}
                            iconColor={site.iconColor}
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-medium text-zinc-900">
                            {site.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                              hits === 0
                                ? "bg-red-100 text-red-700"
                                : hits === table.rows.length
                                  ? "bg-green-100 text-green-700"
                                  : "bg-zinc-200 text-zinc-700",
                            )}
                          >
                            {hits}/{table.rows.length}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {table.rows.map((row) => {
                              const yes = on(table.id, row.key, site.slug);
                              return (
                                <span
                                  key={row.key}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  <Mark
                                    on={yes}
                                    label={
                                      row.label +
                                      " for " +
                                      site.label +
                                      " (" +
                                      table.cornerLabel +
                                      ")"
                                    }
                                  />
                                  <span
                                    className={cn(
                                      "text-sm",
                                      yes ? "text-zinc-700" : "text-zinc-400",
                                    )}
                                  >
                                    {row.label}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                          {/* ⭐ THE REASON IS THE WHOLE POINT. A red mark with
                              no explanation reads as a to-do; a red mark with
                              "there is no such endpoint" reads as an answer. */}
                          {reason ? (
                            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-zinc-500">
                              {reason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
                  {supported.length} of {AUTOMATION_SITES.length} websites
                  {missing.length > 0
                    ? ". Not available on " +
                      missing.map((s) => s.label).join(", ") +
                      "."
                    : "."}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OtherLayouts />
    </div>
  );
}

function OtherLayouts() {
  const others = AUTOMATION_FEATURE_INTEGRATION_VERSIONS.filter(
    (v) => v.href !== SELF,
  );
  if (others.length === 0) return null;
  return (
    <Card>
      <CardContent className="@container p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            The other layouts
          </h2>
          <span className="text-xs text-zinc-500">
            {others.length} pages, each opens in a new tab
          </span>
        </div>
        <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
          {others.map((version) => (
            <VersionTile key={version.href} version={version} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

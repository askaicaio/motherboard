"use client";

// The capability checklist on the Automations Feature Integration page.
//
// ✅✅ TRANSPOSED ON 2026-09-30, promoted from the Alpha2 bench. The user, after
// comparing eight layouts: "the presentation here is good, pls implement it to
// the actual page."
// **IT USED TO BE TWO TABLES, websites across the top and capabilities down the
// side.** It is now ONE table the other way round: a row per website, both
// capability groups across the top under a two-level header, and a coverage bar
// closing each row.
// 📌 WHY THE OTHER WAY ROUND READS BETTER: the question people bring here is
// "what do we get out of GHL", not "who supports Error Date", and **a ROW has
// somewhere to put a summary while a column header does not**. The two old
// tables also shared the same five columns, so splitting them meant a website's
// column restarted halfway down the page.
// ⚠️ WHAT IT COST: 1009px of width against the old 722, which is why the page's
// floor moved in the same change. See the note on that floor.
//
// Each cell is a two-state checkbox: FALSE = red square with an X, TRUE = green
// square with a check. Clicking toggles it and persists via POST
// /api/automations/feature-integration (state is stored app-wide in
// app_settings — shared, survives reload). Updates are optimistic and roll back
// on error.
//
// ⏸️ TOGGLING TEMPORARILY DISABLED (2026-07-25): the marks are currently LOCKED
// to their stored values (display-only) via the TOGGLE_ENABLED flag below. All
// the toggle machinery (optimistic update, POST persistence, rollback) is kept
// intact — flip TOGGLE_ENABLED back to `true` to re-enable click-to-toggle.

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
// ⚠️ SHARED SINCE 2026-09-29, when the Feature Integration layout benches
// needed the same five logos. It is a leaf, not a layout; see its header.
import { SiteIcon } from "@/components/automations/site-icon";
import {
  FEATURE_INTEGRATION_TABLES,
  cellKey,
} from "@/lib/automations/feature-integration-spec";

// ───────────────────────────────────────────────────────────────────────────
// Master switch for the click-to-toggle behaviour on this page.
//   true  → cells are clickable and edits persist (the original behaviour).
//   false → cells are LOCKED to their stored values (display-only, no click).
// Currently OFF (temporary). To re-enable editing, set this to `true` — nothing
// else needs to change; the toggle logic below is untouched.
// ───────────────────────────────────────────────────────────────────────────
const TOGGLE_ENABLED = false;

/** One two-state cell. Red square + X (false) / green square + check (true).
 *  When `interactive` (TOGGLE_ENABLED) it's a clickable button that toggles and
 *  is disabled while its own save is in flight; when locked it renders the SAME
 *  mark as a static, non-clickable indicator (no hover, no click). */
function CheckboxCell({
  checked,
  pending,
  onToggle,
  label,
  interactive,
}: {
  checked: boolean;
  pending: boolean;
  onToggle: () => void;
  label: string;
  interactive: boolean;
}) {
  // Shared look: fixed square, rounded, white glyph, green (on) / red (off).
  const base = cn(
    "inline-flex h-6 w-6 items-center justify-center rounded-md text-white",
    checked ? "bg-green-600" : "bg-red-600",
  );
  const glyph = checked ? (
    <Check className="h-4 w-4" />
  ) : (
    <X className="h-4 w-4" />
  );

  // Locked: a static indicator, identical mark but not clickable (no hover
  // affordance, no toggle). Re-enable via TOGGLE_ENABLED.
  //
  // The tooltip just names what the mark means. It used to add a second sentence
  // ("These marks are read-only for now, so clicking one does nothing.") to
  // explain why clicking does nothing; the user cut it on 2026-08-29, in the
  // same pass that shortened every other Automations tooltip. Do not add it
  // back without asking.
  if (!interactive) {
    return (
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <span
              role="img"
              aria-label={`${label}: ${checked ? "enabled" : "disabled"}`}
              className={base}
            >
              {glyph}
            </span>
          }
        />
        <TooltipContent className="max-w-xs">
          {label}: {checked ? "supported" : "not supported"}.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={checked}
      aria-label={`${label}: ${checked ? "enabled" : "disabled"}`}
      className={cn(
        base,
        "transition-colors disabled:opacity-60",
        checked ? "hover:bg-green-500" : "hover:bg-red-500",
      )}
    >
      {glyph}
    </button>
  );
}

export function FeatureIntegrationTables({
  initialState = {},
}: {
  /** Stored checklist state: map of checked cell keys -> true. */
  initialState?: Record<string, boolean>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initialState);
  // Cell keys with a save currently in flight (their checkbox is disabled).
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toggle = async (key: string) => {
    if (!TOGGLE_ENABLED) return; // toggling temporarily disabled (marks locked)
    if (pending.has(key)) return; // ignore while this cell is saving
    const next = !state[key];

    // Optimistic: flip immediately, mark this cell pending.
    setState((prev) => ({ ...prev, [key]: next }));
    setPending((prev) => new Set(prev).add(key));

    try {
      const res = await fetch("/api/automations/feature-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: next }),
      });
      if (!res.ok) throw new Error();
      // Reconcile with the server's canonical map (keeps us in sync if another
      // user changed a different cell between our read and write).
      const data = await res.json().catch(() => null);
      if (data?.state) setState(data.state as Record<string, boolean>);
    } catch {
      // Roll back this cell on failure.
      setState((prev) => ({ ...prev, [key]: !next }));
      toast.error("Couldn't save that change. Please try again.");
    } finally {
      setPending((prev) => {
        const copy = new Set(prev);
        copy.delete(key);
        return copy;
      });
    }
  };

  // ⭐ ONE FLATTENED COLUMN LIST, used by the group header spans, the label
  // row and every body cell. **Deriving all three from the same array is what
  // makes it impossible for a span and a cell to disagree about which column is
  // which**, which is the failure mode a two-level header invites.
  const columns = FEATURE_INTEGRATION_TABLES.flatMap((table) =>
    table.rows.map((row) => ({
      tableId: table.id,
      group: table.cornerLabel,
      rowKey: row.key,
      label: row.label,
    })),
  );

  return (
    // The shared TOOLTIP_DELAY_MS, so a tooltip anywhere in the
    // Automations tab waits the same beat before appearing.
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            {/* Two-level header. The group row spans its own four columns, so
                "Name and Link" can appear in both groups without ambiguity;
                that reuse is exactly why the group row cannot be dropped. */}
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th
                  rowSpan={2}
                  className="whitespace-nowrap border-b border-r px-3 py-2 text-left align-bottom font-semibold text-zinc-900"
                >
                  Website
                </th>
                {FEATURE_INTEGRATION_TABLES.map((table) => (
                  <th
                    key={table.id}
                    colSpan={table.rows.length}
                    className="border-b border-l px-3 pb-1 pt-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {table.cornerLabel}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="whitespace-nowrap border-b border-l px-3 py-2 text-right align-bottom font-medium"
                >
                  Coverage
                </th>
              </tr>
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={col.tableId + ":" + col.rowKey}
                    className={cn(
                      "whitespace-nowrap border-b px-3 pb-2 text-center text-xs font-medium",
                      // A left rule only where a group starts, so the two bands
                      // stay legible without striping every column.
                      index > 0 && col.tableId !== columns[index - 1].tableId
                        ? "border-l"
                        : "",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUTOMATION_SITES.map((site) => {
                const hits = columns.filter(
                  (col) => !!state[cellKey(col.tableId, col.rowKey, site.slug)],
                ).length;
                const pct = Math.round((hits / columns.length) * 100);
                return (
                  <tr key={site.slug} className="border-t">
                    <th
                      scope="row"
                      className="whitespace-nowrap border-r px-3 py-2 text-left font-medium text-zinc-900"
                    >
                      <span className="inline-flex items-center gap-2">
                        <SiteIcon
                          icon={site.icon}
                          iconColor={site.iconColor}
                          className="h-5 w-5"
                        />
                        {site.label}
                      </span>
                    </th>
                    {columns.map((col, index) => {
                      const key = cellKey(col.tableId, col.rowKey, site.slug);
                      return (
                        <td
                          key={col.tableId + ":" + col.rowKey}
                          className={cn(
                            "px-3 py-2 text-center",
                            index > 0 &&
                              col.tableId !== columns[index - 1].tableId
                              ? "border-l"
                              : "",
                          )}
                        >
                          <CheckboxCell
                            checked={!!state[key]}
                            pending={pending.has(key)}
                            onToggle={() => toggle(key)}
                            label={`${col.label} for ${site.label} (${col.group})`}
                            interactive={TOGGLE_ENABLED}
                          />
                        </td>
                      );
                    })}
                    {/* ⭐ THE ROW SUMMARY IS WHAT TRANSPOSING BUYS. The old
                        layout had nowhere to put this: a column header cannot
                        carry a bar and a count. */}
                    <td className="border-l px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              hits === 0 ? "bg-red-500" : "bg-green-600",
                            )}
                            style={{ width: pct + "%" }}
                          />
                        </span>
                        <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500">
                          {hits} of {columns.length}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

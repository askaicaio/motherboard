"use client";

// The two checklist tables on the Automations Feature Integration page.
//
// Each table (spec in feature-integration-spec.ts) has the automation websites
// as columns and features as rows. Every cell is a two-state checkbox: FALSE =
// red square with an X, TRUE = green square with a check. Clicking toggles it
// and persists via POST /api/automations/feature-integration (state is stored
// app-wide in app_settings — shared, survives reload). Updates are optimistic
// and roll back on error.

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import {
  FEATURE_INTEGRATION_TABLES,
  cellKey,
} from "@/lib/automations/feature-integration-spec";

/** Website column header: the brand logo (sized to the label text) + the label.
 *  Monochrome SVG glyphs are tinted via CSS mask when iconColor is set (Make /
 *  n8n); full-colour icons (GHL / Zapier) render as a plain image. */
function SiteIcon({
  icon,
  iconColor,
}: {
  icon: string;
  iconColor?: string;
}) {
  if (iconColor) {
    return (
      <span
        aria-hidden
        className="h-4 w-4 shrink-0"
        style={{
          backgroundColor: iconColor,
          maskImage: `url(${icon})`,
          WebkitMaskImage: `url(${icon})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />;
}

/** One two-state checkbox cell. Red square + X (false) / green square + check
 *  (true). Disabled while its own save is in flight. */
function CheckboxCell({
  checked,
  pending,
  onToggle,
  label,
}: {
  checked: boolean;
  pending: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={checked}
      aria-label={`${label}: ${checked ? "enabled" : "disabled"}`}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-white transition-colors disabled:opacity-60",
        checked
          ? "bg-green-600 hover:bg-green-500"
          : "bg-red-600 hover:bg-red-500",
      )}
    >
      {checked ? (
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}
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

  return (
    <div className="space-y-6">
      {FEATURE_INTEGRATION_TABLES.map((table) => (
        <Card key={table.id}>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  {/* Corner cell: names the table (top-left). */}
                  <th className="border-b px-3 py-2 text-left font-semibold text-zinc-900">
                    {table.cornerLabel}
                  </th>
                  {AUTOMATION_SITES.map((site) => (
                    <th
                      key={site.slug}
                      className="border-b px-3 py-2 text-center font-medium"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <SiteIcon icon={site.icon} iconColor={site.iconColor} />
                        {site.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.key} className="border-t">
                    <th
                      scope="row"
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-700"
                    >
                      {row.label}
                    </th>
                    {AUTOMATION_SITES.map((site) => {
                      const key = cellKey(table.id, row.key, site.slug);
                      return (
                        <td key={site.slug} className="px-3 py-2 text-center">
                          <CheckboxCell
                            checked={!!state[key]}
                            pending={pending.has(key)}
                            onToggle={() => toggle(key)}
                            label={`${row.label} for ${site.label} (${table.cornerLabel})`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

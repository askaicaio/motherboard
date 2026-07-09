"use client";

// Client shell for the Per Website Error History page: owns the Edit-mode
// toggle + delete state, and renders the page header (brand icon + title +
// "Check for New Errors" button) alongside the error-log table.
//
// Edit mode (delete-only): the header toggle (Pencil + Switch, matching the Per
// Website Page) reveals a delete button per row. Deleting hard-removes the row
// (DELETE /api/automations/errors/[id]) with an optimistic update. No add/edit
// dialogs; delete is the only edit-mode action here.

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";
import {
  ErrorHistoryTable,
  type ErrorHistoryRow,
} from "./error-history-table";
import { CheckErrorsButton } from "./check-errors-button";
import { AutoRefreshToggle } from "./auto-refresh-toggle";

interface ErrorHistorySite {
  slug: string;
  label: string;
  icon: string;
  iconColor?: string;
}

export function ErrorHistoryTableClient({
  site,
  canCapture = false,
  hasApiKey = false,
  autoRefresh = { enabled: false, nextRefreshAt: null },
  initialRows = [],
}: {
  site: ErrorHistorySite;
  /** True only for platforms whose error capture is built (Make). */
  canCapture?: boolean;
  /** Whether this platform has an API integration (gates the auto-refresh toggle). */
  hasApiKey?: boolean;
  /** Shared per-platform auto-refresh state (same one the Per Website Page uses). */
  autoRefresh?: { enabled: boolean; nextRefreshAt: string | null };
  initialRows?: ErrorHistoryRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (deletingId) return; // one at a time
    setDeletingId(id);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id)); // optimistic remove
    try {
      const res = await fetch(`/api/automations/errors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(prev); // roll back on failure
      toast.error("Couldn't delete that error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Header row: title block on the left; Edit-mode toggle + "Check for New
          Errors" on the right (same spot as the Per Website Page header). */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* Website brand logo to the LEFT of the title (tinted SVG via CSS
                mask when iconColor is set, else a full-colour image). */}
            {site.iconColor ? (
              <span
                aria-hidden
                className="h-8 w-8 shrink-0"
                style={{
                  backgroundColor: site.iconColor,
                  maskImage: `url(${site.icon})`,
                  WebkitMaskImage: `url(${site.icon})`,
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.icon}
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
            <h1 className="text-2xl font-semibold tracking-tight">
              {site.label} Error History
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Error history for {site.label} automations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh list toggle, a copy of the Per Website Page one, to the
              LEFT of "Check for New Errors". Shared per-platform state, so it
              mirrors the Per Website toggle and (since error capture is coupled
              to it) is the on/off switch for error capture too. */}
          <AutoRefreshToggle
            platform={site.slug}
            hasApiKey={hasApiKey}
            autoRefresh={autoRefresh}
          />
          <CheckErrorsButton platform={site.slug} canCapture={canCapture} />
          {/* Edit mode (delete-only), styled like the Per Website Page toggle;
              sits to the RIGHT of the Check for New Errors button. */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      <ErrorHistoryTable
        rows={rows}
        editMode={editMode}
        onDelete={handleDelete}
        deletingId={deletingId}
      />
    </>
  );
}

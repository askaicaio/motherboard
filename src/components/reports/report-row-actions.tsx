"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Archive, ArchiveRestore, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ReportListItem } from "./report-list-types";

interface Props {
  report: ReportListItem;
  onChanged: () => void;
}

export function ReportRowActions({ report, onChanged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isArchived = !!report.archivedAt;

  async function archive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unarchive: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Archived "${report.companyName}"`);
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    } finally {
      setBusy(false);
    }
  }

  async function unarchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unarchive: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Restored "${report.companyName}"`);
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
    } finally {
      setBusy(false);
    }
  }

  async function permanentlyDelete() {
    if (
      !confirm(
        `PERMANENTLY DELETE "${report.companyName}"?\n\nThis removes all research, sources, and the database record. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Permanently deleted "${report.companyName}"`);
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={busy}
          aria-label="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {report.gammaUrl && (
          <>
            <DropdownMenuItem onSelect={() => window.open(report.gammaUrl!, "_blank")}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Open Gamma deck
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {!isArchived && (
          <DropdownMenuItem onSelect={archive}>
            <Archive className="h-3.5 w-3.5 mr-2" />
            Archive
          </DropdownMenuItem>
        )}

        {isArchived && (
          <>
            <DropdownMenuItem onSelect={unarchive}>
              <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
              Restore from archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={permanentlyDelete}
              className="text-red-600 focus:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete permanently
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

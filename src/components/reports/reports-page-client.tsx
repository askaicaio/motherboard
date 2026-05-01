"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  FileText,
  List,
  Columns,
  LayoutGrid,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportsListView } from "./reports-list-view";
import { ReportsBoardView } from "./reports-board-view";
import { ReportsGalleryView } from "./reports-gallery-view";
import type { ReportListItem, ViewMode } from "./report-list-types";

interface Props {
  initialReports: ReportListItem[];
  initialArchived: boolean;
  archivedCount: number;
}

export function ReportsPageClient({
  initialReports,
  initialArchived,
  archivedCount,
}: Props) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [showArchived, setShowArchived] = useState(initialArchived);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("reports-view") as ViewMode) || "list";
  });

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("reports-view", view);
    }
  }, [view]);

  function refresh() {
    router.refresh();
  }

  function toggleArchived(showArchivedNow: boolean) {
    setShowArchived(showArchivedNow);
    const url = showArchivedNow ? "/reports?archived=1" : "/reports";
    router.push(url);
  }

  const visibleCount = reports.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {showArchived ? "Archived Reports" : "Company Reports"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {showArchived
              ? "Restore archived reports or permanently delete them."
              : "McKinsey-caliber Strategic Growth Reports for prospects. Two-stage workflow: deep research → Gamma deck generation."}
          </p>
        </div>

        {!showArchived && (
          <Link href="/reports/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Report
            </Button>
          </Link>
        )}

        {showArchived && (
          <Button
            variant="ghost"
            onClick={() => toggleArchived(false)}
            className="gap-2"
          >
            <ArchiveRestore className="h-4 w-4" />
            Back to active
          </Button>
        )}
      </div>

      {/* Toolbar: view switcher + counts */}
      {visibleCount > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-zinc-500">
            {visibleCount} {visibleCount === 1 ? "report" : "reports"}
            {showArchived && " in archive"}
          </div>

          <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-0.5">
            <ViewButton
              active={view === "list"}
              onClick={() => setView("list")}
              icon={<List className="h-3.5 w-3.5" />}
              label="List"
            />
            <ViewButton
              active={view === "board"}
              onClick={() => setView("board")}
              icon={<Columns className="h-3.5 w-3.5" />}
              label="Board"
            />
            <ViewButton
              active={view === "gallery"}
              onClick={() => setView("gallery")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label="Gallery"
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {visibleCount === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            {showArchived ? (
              <>
                <Archive className="h-12 w-12 mx-auto text-zinc-300" />
                <h3 className="mt-4 text-base font-medium text-zinc-900">
                  No archived reports
                </h3>
                <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
                  Archive reports from the active list to keep your workspace
                  tidy without losing the work.
                </p>
                <Button
                  className="mt-6 gap-2"
                  variant="outline"
                  onClick={() => toggleArchived(false)}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  Back to active
                </Button>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 mx-auto text-zinc-300" />
                <h3 className="mt-4 text-base font-medium text-zinc-900">
                  No reports yet
                </h3>
                <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
                  Create your first Strategic Growth Report. The system will
                  research the prospect, then generate a polished Gamma deck.
                </p>
                <Link href="/reports/new" className="mt-6 inline-block">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Report
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {view === "list" && (
            <ReportsListView reports={reports} onChanged={refresh} />
          )}
          {view === "board" && (
            <ReportsBoardView reports={reports} onChanged={refresh} />
          )}
          {view === "gallery" && (
            <ReportsGalleryView reports={reports} onChanged={refresh} />
          )}
        </>
      )}

      {/* Footer: archive toggle */}
      {!showArchived && archivedCount > 0 && (
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-center">
          <button
            onClick={() => toggleArchived(true)}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            View {archivedCount} archived report{archivedCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

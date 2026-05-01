"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Sparkles,
  Presentation,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import type { ReportListItem } from "./report-list-types";
import { ReportRowActions } from "./report-row-actions";

type Lane =
  | "draft"
  | "researching"
  | "research_done"
  | "generating_gamma"
  | "complete"
  | "failed";

interface LaneConfig {
  id: Lane;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  border: string;
}

const LANES: LaneConfig[] = [
  {
    id: "draft",
    label: "Draft",
    description: "Awaiting research kickoff",
    icon: Clock,
    color: "bg-zinc-50",
    border: "border-zinc-200",
  },
  {
    id: "researching",
    label: "Researching",
    description: "Stage 1 in progress",
    icon: Sparkles,
    color: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    id: "research_done",
    label: "Research Done",
    description: "Ready for Gamma",
    icon: CheckCircle2,
    color: "bg-purple-50",
    border: "border-purple-200",
  },
  {
    id: "generating_gamma",
    label: "Generating Deck",
    description: "Gamma in progress",
    icon: Presentation,
    color: "bg-indigo-50",
    border: "border-indigo-200",
  },
  {
    id: "complete",
    label: "Complete",
    description: "Deck delivered",
    icon: CheckCircle2,
    color: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    id: "failed",
    label: "Needs Attention",
    description: "Failed at any stage",
    icon: AlertCircle,
    color: "bg-red-50",
    border: "border-red-200",
  },
];

function laneFor(report: ReportListItem): Lane {
  if (report.researchStatus === "failed" || report.gammaStatus === "failed") {
    return "failed";
  }
  if (report.gammaStatus === "complete") return "complete";
  if (report.gammaStatus === "running") return "generating_gamma";
  if (report.researchStatus === "complete") return "research_done";
  if (report.researchStatus === "running") return "researching";
  return "draft";
}

export function ReportsBoardView({
  reports,
  onChanged,
}: {
  reports: ReportListItem[];
  onChanged: () => void;
}) {
  const grouped: Record<Lane, ReportListItem[]> = {
    draft: [],
    researching: [],
    research_done: [],
    generating_gamma: [],
    complete: [],
    failed: [],
  };

  for (const r of reports) {
    grouped[laneFor(r)].push(r);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {LANES.map((lane) => {
        const items = grouped[lane.id];
        const Icon = lane.icon;
        return (
          <div
            key={lane.id}
            className={`flex flex-col rounded-lg border ${lane.border} ${lane.color}`}
          >
            <div className="px-3 py-2.5 border-b border-zinc-200/70">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-zinc-600" />
                <span className="text-xs font-medium text-zinc-900">
                  {lane.label}
                </span>
                <Badge className="ml-auto bg-white/70 text-zinc-600 font-normal text-xs">
                  {items.length}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {lane.description}
              </div>
            </div>

            <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[700px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-xs text-zinc-400 italic px-2 py-4 text-center">
                  No reports in this stage
                </div>
              ) : (
                items.map((report) => (
                  <ReportBoardCard
                    key={report.id}
                    report={report}
                    onChanged={onChanged}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportBoardCard({
  report,
  onChanged,
}: {
  report: ReportListItem;
  onChanged: () => void;
}) {
  return (
    <Card className="p-3 bg-white hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/reports/${report.id}`}
          className="flex-1 min-w-0 group-hover:underline"
        >
          <div className="font-medium text-sm text-zinc-900 truncate">
            {report.companyName}
          </div>
          {report.industry && (
            <div className="text-xs text-zinc-500 truncate mt-0.5">
              {report.industry}
            </div>
          )}
        </Link>
        <ReportRowActions report={report} onChanged={onChanged} />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
        <span>{format(new Date(report.createdAt), "MMM d")}</span>
        {report.gammaUrl && (
          <a
            href={report.gammaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-indigo-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Deck
          </a>
        )}
      </div>
    </Card>
  );
}

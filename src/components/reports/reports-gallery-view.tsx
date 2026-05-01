"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Sparkles, Clock } from "lucide-react";
import { format } from "date-fns";
import { REPORT_STAGE_STATUS_CONFIG } from "@/types";
import type { ReportListItem } from "./report-list-types";
import { ReportRowActions } from "./report-row-actions";

export function ReportsGalleryView({
  reports,
  onChanged,
}: {
  reports: ReportListItem[];
  onChanged: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {reports.map((report) => (
        <ReportGalleryCard
          key={report.id}
          report={report}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function ReportGalleryCard({
  report,
  onChanged,
}: {
  report: ReportListItem;
  onChanged: () => void;
}) {
  const research = REPORT_STAGE_STATUS_CONFIG[report.researchStatus];
  const gamma = REPORT_STAGE_STATUS_CONFIG[report.gammaStatus];
  const isComplete = report.gammaStatus === "complete" && !!report.gammaUrl;
  const sourceCount = report.researchSources?.length ?? 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all relative group flex flex-col">
      {/* Top: hero strip */}
      <div
        className={`h-24 relative flex items-end ${
          isComplete
            ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
            : report.researchStatus === "failed" || report.gammaStatus === "failed"
              ? "bg-gradient-to-br from-zinc-400 to-zinc-500"
              : report.researchStatus === "complete"
                ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                : "bg-gradient-to-br from-zinc-200 to-zinc-300"
        }`}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative px-4 pb-3 text-white">
          <FileText className="h-5 w-5 opacity-80 mb-1" />
        </div>
        <div className="absolute top-2 right-2">
          <ReportRowActions report={report} onChanged={onChanged} />
        </div>
      </div>

      <CardContent className="pt-4 flex-1">
        <Link href={`/reports/${report.id}`} className="block group-hover:underline">
          <h3 className="font-medium text-zinc-900 line-clamp-2 leading-tight">
            {report.companyName}
          </h3>
        </Link>
        {report.industry && (
          <div className="text-xs text-zinc-500 mt-1 truncate">
            {report.industry}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge className={`${research.color} text-xs`}>
            <Sparkles className="h-2.5 w-2.5 mr-1" />
            {research.label}
          </Badge>
          <Badge className={`${gamma.color} text-xs`}>{gamma.label}</Badge>
        </div>

        {sourceCount > 0 && (
          <div className="mt-2 text-xs text-zinc-500">
            {sourceCount} source{sourceCount !== 1 ? "s" : ""}
            {report.researchCostUsd && (
              <> · ${parseFloat(report.researchCostUsd).toFixed(2)}</>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t bg-zinc-50/50 py-2.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          {format(new Date(report.createdAt), "MMM d, yyyy")}
        </div>
        {report.gammaUrl ? (
          <a href={report.gammaUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
          </a>
        ) : (
          <Link href={`/reports/${report.id}`}>
            <Button size="sm" variant="ghost" className="h-7 text-xs">
              View
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

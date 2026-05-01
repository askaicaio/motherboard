"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { REPORT_STAGE_STATUS_CONFIG } from "@/types";
import type { ReportListItem } from "./report-list-types";
import { ReportRowActions } from "./report-row-actions";

export function ReportsListView({
  reports,
  onChanged,
}: {
  reports: ReportListItem[];
  onChanged: () => void;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Research</TableHead>
            <TableHead>Gamma</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => {
            const research = REPORT_STAGE_STATUS_CONFIG[report.researchStatus];
            const gamma = REPORT_STAGE_STATUS_CONFIG[report.gammaStatus];
            return (
              <TableRow key={report.id}>
                <TableCell>
                  <Link
                    href={`/reports/${report.id}`}
                    className="font-medium hover:underline"
                  >
                    {report.companyName}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-500 text-sm">
                  {report.industry || <span className="italic">—</span>}
                </TableCell>
                <TableCell>
                  <Badge className={research.color}>{research.label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={gamma.color}>{gamma.label}</Badge>
                </TableCell>
                <TableCell className="text-zinc-500 text-sm">
                  {format(new Date(report.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {report.gammaUrl ? (
                      <a
                        href={report.gammaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="ghost" className="gap-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      </a>
                    ) : (
                      <Link href={`/reports/${report.id}`}>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </Link>
                    )}
                    <ReportRowActions report={report} onChanged={onChanged} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

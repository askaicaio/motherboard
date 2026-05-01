import Link from "next/link";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";

// Always render fresh — never prerender at build time (needs DB).
export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { desc } from "drizzle-orm";
import { REPORT_STAGE_STATUS_CONFIG } from "@/types";
import { format } from "date-fns";

export default async function ReportsListPage() {
  const reports = await db
    .select()
    .from(companyReports)
    .orderBy(desc(companyReports.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Company Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">
            McKinsey-caliber Strategic Growth Reports for prospects.
            Two-stage workflow: deep research → Gamma deck generation.
          </p>
        </div>
        <Link href="/reports/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Research</TableHead>
                <TableHead>Gamma</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

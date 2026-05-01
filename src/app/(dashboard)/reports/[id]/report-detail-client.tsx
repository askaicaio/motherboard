"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  Presentation,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  RefreshCw,
  Trash2,
  Clock,
} from "lucide-react";
import { REPORT_STAGE_STATUS_CONFIG } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface CompanyReport {
  id: string;
  companyName: string;
  industry: string | null;
  knownDetails: string | null;
  titleFormat: string;
  researchStatus: "pending" | "running" | "complete" | "failed";
  researchStartedAt: Date | string | null;
  researchCompletedAt: Date | string | null;
  researchMarkdown: string | null;
  researchError: string | null;
  researchProvider: string | null;
  researchModel: string | null;
  gammaStatus: "pending" | "running" | "complete" | "failed";
  gammaStartedAt: Date | string | null;
  gammaCompletedAt: Date | string | null;
  gammaUrl: string | null;
  gammaError: string | null;
  createdAt: Date | string;
}

export function ReportDetailClient({
  initialReport,
}: {
  initialReport: CompanyReport;
}) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [researchLoading, setResearchLoading] = useState(false);
  const [gammaLoading, setGammaLoading] = useState(false);

  const research = REPORT_STAGE_STATUS_CONFIG[report.researchStatus];
  const gamma = REPORT_STAGE_STATUS_CONFIG[report.gammaStatus];

  async function refresh() {
    const res = await fetch(`/api/reports/${report.id}`);
    if (res.ok) {
      const { report: fresh } = await res.json();
      setReport(fresh);
    }
  }

  async function runResearch() {
    setResearchLoading(true);
    setReport({ ...report, researchStatus: "running" });
    try {
      const res = await fetch(`/api/reports/${report.id}/research`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { report: updated } = await res.json();
      setReport(updated);
      toast.success("Research complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Research failed");
      await refresh();
    } finally {
      setResearchLoading(false);
    }
  }

  async function runGamma() {
    setGammaLoading(true);
    setReport({ ...report, gammaStatus: "running" });
    try {
      const res = await fetch(`/api/reports/${report.id}/gamma`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { report: updated } = await res.json();
      setReport(updated);
      toast.success("Gamma deck generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gamma generation failed");
      await refresh();
    } finally {
      setGammaLoading(false);
    }
  }

  async function copyMarkdown() {
    if (!report.researchMarkdown) return;
    await navigator.clipboard.writeText(report.researchMarkdown);
    toast.success("Markdown copied to clipboard");
  }

  async function deleteReport() {
    if (!confirm(`Delete the report for "${report.companyName}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Report deleted");
      router.push("/reports");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const canRunResearch =
    report.researchStatus === "pending" || report.researchStatus === "failed";
  const canRunGamma =
    report.researchStatus === "complete" &&
    (report.gammaStatus === "pending" || report.gammaStatus === "failed");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to reports
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{report.companyName}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {report.industry && <>{report.industry} · </>}
              Created {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={deleteReport} className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* ---- Two-stage workflow ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stage 1: Research */}
        <Card className={report.researchStatus === "complete" ? "border-emerald-200" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-base">1. Deep Research</CardTitle>
              </div>
              <Badge className={research.color}>
                {report.researchStatus === "running" && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {research.label}
              </Badge>
            </div>
            <CardDescription>
              Claude researches the company and generates a 10-slide markdown report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.researchStatus === "pending" && (
              <Button onClick={runResearch} disabled={researchLoading} className="w-full">
                {researchLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting research...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Deep Research
                  </>
                )}
              </Button>
            )}

            {report.researchStatus === "running" && (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
                <div>
                  <strong>Research in progress.</strong> Claude is searching the
                  web and assembling the report. In live mode this takes 4-6 minutes;
                  in mock mode ~5 seconds.
                </div>
              </div>
            )}

            {report.researchStatus === "complete" && (
              <div className="space-y-2">
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Research complete.</strong>{" "}
                    {report.researchCompletedAt && (
                      <>
                        Finished {formatDistanceToNow(new Date(report.researchCompletedAt))} ago.
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Provider: {report.researchProvider || "—"}</span>
                  {report.researchModel && (
                    <>
                      <span>·</span>
                      <span>Model: {report.researchModel}</span>
                    </>
                  )}
                  {report.researchMarkdown && (
                    <>
                      <span>·</span>
                      <span>{report.researchMarkdown.length.toLocaleString()} chars</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {canRunResearch && report.researchStatus === "failed" && (
              <>
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  <strong>Research failed:</strong>
                  <p className="mt-1 text-xs">{report.researchError}</p>
                </div>
                <Button onClick={runResearch} disabled={researchLoading} className="w-full" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Research
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stage 2: Gamma */}
        <Card className={report.gammaStatus === "complete" ? "border-emerald-200" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Presentation className="h-4 w-4 text-indigo-500" />
                <CardTitle className="text-base">2. Generate Gamma Deck</CardTitle>
              </div>
              <Badge className={gamma.color}>
                {report.gammaStatus === "running" && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {gamma.label}
              </Badge>
            </div>
            <CardDescription>
              Pipe the research markdown into Gamma to create a polished 10-slide deck.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canRunGamma && report.researchStatus !== "complete" && report.gammaStatus !== "complete" && (
              <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>Run Deep Research first. Once it&apos;s complete, this button activates.</div>
              </div>
            )}

            {canRunGamma && (
              <Button onClick={runGamma} disabled={gammaLoading} className="w-full">
                {gammaLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating deck...
                  </>
                ) : (
                  <>
                    <Presentation className="h-4 w-4 mr-2" />
                    {report.gammaStatus === "failed" ? "Retry Gamma" : "Generate Gamma Deck"}
                  </>
                )}
              </Button>
            )}

            {report.gammaStatus === "running" && (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
                <div>
                  <strong>Generating Gamma deck.</strong> Usually takes 1-2 minutes.
                </div>
              </div>
            )}

            {report.gammaStatus === "complete" && report.gammaUrl && (
              <div className="space-y-2">
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Deck ready.</strong>{" "}
                    {report.gammaCompletedAt && (
                      <>Generated {formatDistanceToNow(new Date(report.gammaCompletedAt))} ago.</>
                    )}
                  </div>
                </div>
                <a href={report.gammaUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Gamma
                  </Button>
                </a>
              </div>
            )}

            {report.gammaStatus === "failed" && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <strong>Gamma generation failed:</strong>
                <p className="mt-1 text-xs">{report.gammaError}</p>
                <p className="mt-2 text-xs">
                  Tip: you can copy the markdown below and paste it into
                  Gamma manually as a fallback.
                </p>
              </div>
            )}

            {report.researchMarkdown && (
              <Button onClick={copyMarkdown} variant="ghost" size="sm" className="w-full">
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy markdown to clipboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Research output preview ---- */}
      {report.researchMarkdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Research output</CardTitle>
            <CardDescription>
              The 10-slide markdown that will be (or was) sent to Gamma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 max-h-[600px] overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-700 leading-relaxed">
                {report.researchMarkdown}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Input details ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Company</div>
              <div className="font-medium">{report.companyName}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Industry</div>
              <div>{report.industry || <span className="italic text-zinc-400">—</span>}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Title format</div>
              <div className="text-xs">
                {report.titleFormat === "ebitda_expansion"
                  ? "Operational Excellence & EBITDA Expansion"
                  : "Strategic Growth Through AI"}
              </div>
            </div>
          </div>
          {report.knownDetails && (
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Known details</div>
              <div className="text-xs whitespace-pre-wrap">{report.knownDetails}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

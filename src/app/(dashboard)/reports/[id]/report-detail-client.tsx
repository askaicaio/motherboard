"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResearchProgress } from "@/components/reports/research-progress";
import { GammaProgress } from "@/components/reports/gamma-progress";
import { DossierViewer } from "@/components/reports/dossier-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { REPORT_STAGE_STATUS_CONFIG } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ResearchSource {
  url: string;
  title: string;
  pageAge?: string;
}

interface CompanyReport {
  id: string;
  companyName: string;
  industry: string | null;
  knownDetails: string | null;
  titleFormat: string;
  researchStatus: "pending" | "running" | "complete" | "failed";
  researchPhase?: string | null; // "researching" | "distilling" | null
  researchStartedAt: Date | string | null;
  researchCompletedAt: Date | string | null;
  researchDossier?: string | null; // Long-form research (stage 1)
  researchMarkdown: string | null; // 10-slide markdown (stage 2 — sent to Gamma)
  researchError: string | null;
  researchProvider: string | null;
  researchModel: string | null;
  researchSources?: ResearchSource[] | null;
  researchInputTokens?: number | null;
  researchOutputTokens?: number | null;
  researchCacheReadTokens?: number | null;
  researchCacheCreationTokens?: number | null;
  researchWebSearchCount?: number | null;
  researchCostUsd?: string | null;
  researchThinkingSummary?: string | null;
  gammaStatus: "pending" | "running" | "complete" | "failed";
  gammaStartedAt: Date | string | null;
  gammaCompletedAt: Date | string | null;
  gammaUrl: string | null;
  gammaError: string | null;
  gammaCreditsDeducted?: number | null;
  gammaCreditsRemaining?: number | null;
  archivedAt?: Date | string | null;
  archivedBy?: string | null;
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const research = REPORT_STAGE_STATUS_CONFIG[report.researchStatus];
  const gamma = REPORT_STAGE_STATUS_CONFIG[report.gammaStatus];

  async function refresh() {
    const res = await fetch(`/api/reports/${report.id}`);
    if (res.ok) {
      const { report: fresh } = await res.json();
      setReport(fresh);
    }
  }

  // Poll for status updates while research or Gamma is running
  useEffect(() => {
    const isPolling =
      report.researchStatus === "running" || report.gammaStatus === "running";

    if (!isPolling) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    if (pollIntervalRef.current) return; // already polling

    pollIntervalRef.current = setInterval(refresh, 5000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.researchStatus, report.gammaStatus]);

  async function resetStuckResearch() {
    if (!confirm("Reset this stuck job? It will be marked as failed and you can retry.")) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/${report.id}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "research" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Job reset — you can now retry");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset");
    }
  }

  async function resetStuckGamma() {
    if (!confirm("Reset stuck Gamma generation? It will be marked as failed and you can retry.")) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/${report.id}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "gamma" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Gamma generation reset — you can now retry");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset");
    }
  }

  async function runResearch() {
    setResearchLoading(true);
    setReport({ ...report, researchStatus: "running", researchPhase: "researching" });
    try {
      const res = await fetch(`/api/reports/${report.id}/research`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Live mode (Inngest): API returns immediately with no report.
      // Polling will pick up status updates as the background job runs.
      if (data.mode === "live") {
        toast.success("Research started — running in the background");
        await refresh();
      } else if (data.report) {
        // Mock mode: synchronous, returns full report
        setReport(data.report);
        toast.success("Research complete");
      } else {
        await refresh();
      }
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
      const data = await res.json();
      if (data.mode === "live") {
        toast.success("Gamma generation started — running in the background");
        await refresh();
      } else if (data.report) {
        setReport(data.report);
        toast.success("Gamma deck generated");
      } else {
        await refresh();
      }
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

  async function archiveReport() {
    if (!confirm(`Archive "${report.companyName}"?\n\nIt will be moved to the Archived list. You can restore it later.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/${report.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unarchive: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Report archived");
      router.push("/reports");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    }
  }

  async function unarchiveReport() {
    try {
      const res = await fetch(`/api/reports/${report.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unarchive: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Report restored");
      router.push("/reports");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
    }
  }

  async function deletePermanently() {
    if (
      !confirm(
        `PERMANENTLY DELETE "${report.companyName}"?\n\nThis removes the database record entirely. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Report permanently deleted");
      router.push("/reports?archived=1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const isArchived = !!(report as { archivedAt?: Date | string | null }).archivedAt;

  const canRunResearch =
    report.researchStatus === "pending" || report.researchStatus === "failed";
  const canRunGamma =
    report.researchStatus === "complete" &&
    (report.gammaStatus === "pending" || report.gammaStatus === "failed");

  return (
    <div className="space-y-6">
      {isArchived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-center gap-2">
          <Archive className="h-4 w-4" />
          <div className="flex-1">
            <strong>Archived.</strong> This report is hidden from the main list.
            Restore it to bring it back, or delete it permanently.
          </div>
        </div>
      )}
      <div>
        <Link
          href={isArchived ? "/reports?archived=1" : "/reports"}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {isArchived ? "archive" : "reports"}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{report.companyName}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {report.industry && <>{report.industry} · </>}
              Created {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isArchived ? (
              <>
                <Button variant="outline" size="sm" onClick={unarchiveReport}>
                  <ArchiveRestore className="h-4 w-4 mr-1.5" />
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deletePermanently}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete permanently
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={archiveReport}>
                <Archive className="h-4 w-4 mr-1.5" />
                Archive
              </Button>
            )}
          </div>
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
              <div className="flex items-center gap-1.5">
                {report.researchCostUsd && parseFloat(report.researchCostUsd) > 0 && (
                  <Badge className="bg-zinc-100 text-zinc-700 font-mono">
                    ${parseFloat(report.researchCostUsd).toFixed(2)}
                  </Badge>
                )}
                <Badge className={research.color}>
                  {report.researchStatus === "running" && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {research.label}
                </Badge>
              </div>
            </div>
            <CardDescription>
              Two-stage workflow: Claude builds a comprehensive research
              dossier, then distills it into a 10-slide deck markdown.
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

            {report.researchStatus === "running" && report.researchStartedAt && (
              <div className="space-y-3">
                <ResearchProgress
                  startedAt={report.researchStartedAt}
                  phase={
                    (report.researchPhase as "researching" | "distilling" | null) ?? null
                  }
                  status={report.researchStatus}
                  onReset={resetStuckResearch}
                />
                {report.researchDossier && report.researchPhase === "distilling" && (
                  <div className="rounded-md bg-purple-50 border border-purple-100 p-3 text-xs text-purple-900 flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      Stage 1 complete — dossier ready ({(report.researchDossier.length / 1000).toFixed(1)}K chars).
                    </div>
                    <DossierViewer
                      dossier={report.researchDossier}
                      companyName={report.companyName}
                      trigger={
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2">
                          View dossier
                        </Button>
                      }
                    />
                  </div>
                )}
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
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {report.researchModel && (
                    <div>
                      <span className="text-zinc-500">Model:</span>{" "}
                      <span className="font-mono text-zinc-700">{report.researchModel}</span>
                    </div>
                  )}
                  {report.researchWebSearchCount !== null && report.researchWebSearchCount !== undefined && (
                    <div>
                      <span className="text-zinc-500">Web searches:</span>{" "}
                      <span className="font-medium text-zinc-700">{report.researchWebSearchCount}</span>
                    </div>
                  )}
                  {report.researchSources && report.researchSources.length > 0 && (
                    <div>
                      <span className="text-zinc-500">Sources:</span>{" "}
                      <span className="font-medium text-zinc-700">{report.researchSources.length}</span>
                    </div>
                  )}
                  {report.researchCostUsd && (
                    <div>
                      <span className="text-zinc-500">Cost:</span>{" "}
                      <span className="font-medium text-zinc-700">${parseFloat(report.researchCostUsd).toFixed(2)}</span>
                    </div>
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

            {report.gammaStatus === "running" && report.gammaStartedAt && (
              <GammaProgress
                startedAt={report.gammaStartedAt}
                status={report.gammaStatus}
                onReset={resetStuckGamma}
              />
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

      {/* ---- Research output: dossier viewer + slide markdown ---- */}
      {(report.researchDossier || report.researchMarkdown) && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Research output</CardTitle>
                <CardDescription>
                  Two-stage output: comprehensive dossier (intelligence) and 10-slide markdown (sent to Gamma).
                </CardDescription>
              </div>
              {report.researchDossier && (
                <DossierViewer
                  dossier={report.researchDossier}
                  companyName={report.companyName}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {report.researchMarkdown ? (
              <Tabs
                defaultValue={report.researchMarkdown ? "slides" : "dossier"}
                className="w-full"
              >
                <TabsList>
                  {report.researchDossier && (
                    <TabsTrigger value="dossier" className="gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Research Dossier
                      <Badge className="ml-1 bg-zinc-100 text-zinc-600 font-normal">
                        {(report.researchDossier.length / 1000).toFixed(1)}K
                      </Badge>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="slides" className="gap-2">
                    <Presentation className="h-3.5 w-3.5" />
                    10-Slide Markdown
                    <Badge className="ml-1 bg-zinc-100 text-zinc-600 font-normal">
                      For Gamma
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {report.researchDossier && (
                  <TabsContent value="dossier" className="mt-3">
                    <div className="text-xs text-zinc-500 mb-2 flex items-center justify-between">
                      <span>Quick markdown preview. Click <strong>View Research Dossier</strong> above for the rendered version.</span>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 max-h-[400px] overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-700 leading-relaxed">
                        {report.researchDossier}
                      </pre>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="slides" className="mt-3">
                  <div className="text-xs text-zinc-500 mb-2">
                    The 10-slide markdown distilled from the dossier — this is what goes to Gamma.
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 max-h-[600px] overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-700 leading-relaxed">
                      {report.researchMarkdown}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-sm text-zinc-500 flex items-start gap-2 rounded-md bg-purple-50 p-3 border border-purple-100">
                <Sparkles className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
                <div>
                  <strong>Dossier saved.</strong> Stage 2 (slide distillation) hasn&apos;t completed yet.
                  Click <strong>View Research Dossier</strong> above to read the rendered intelligence.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Sources used in research ---- */}
      {report.researchSources && report.researchSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Sources
              <Badge className="bg-zinc-100 text-zinc-600 font-normal">
                {report.researchSources.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              URLs Claude consulted while researching.
              Use these to fact-check the report before sending.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {report.researchSources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-zinc-50 transition-colors group"
                >
                  <span className="text-xs font-mono text-zinc-400 mt-0.5 w-6 flex-shrink-0">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 group-hover:underline truncate">
                      {source.title}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{source.url}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-400 mt-1 flex-shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Token usage / cost details ---- */}
      {report.researchInputTokens !== null && report.researchInputTokens !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage details</CardTitle>
            <CardDescription>Token consumption and cost for this report.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Input tokens</div>
                <div className="font-mono font-medium">
                  {(report.researchInputTokens || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Output tokens</div>
                <div className="font-mono font-medium">
                  {(report.researchOutputTokens || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Cache hits</div>
                <div className="font-mono font-medium">
                  {(report.researchCacheReadTokens || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Web searches</div>
                <div className="font-mono font-medium">
                  {report.researchWebSearchCount || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Research cost</div>
                <div className="font-mono font-medium">
                  ${parseFloat(report.researchCostUsd || "0").toFixed(4)}
                </div>
              </div>
              {report.gammaCreditsDeducted !== null &&
                report.gammaCreditsDeducted !== undefined && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Gamma credits used</div>
                    <div className="font-mono font-medium">{report.gammaCreditsDeducted}</div>
                  </div>
                )}
              {report.gammaCreditsRemaining !== null &&
                report.gammaCreditsRemaining !== undefined && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Gamma credits left</div>
                    <div className="font-mono font-medium">{report.gammaCreditsRemaining}</div>
                  </div>
                )}
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

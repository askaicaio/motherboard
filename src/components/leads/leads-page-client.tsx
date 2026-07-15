"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Sparkles,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AssessmentLead } from "@/lib/assessment/leads";

// ─── Tier + source presentation (light theme, house pill idiom) ───────────────
const TIER_TONE: Record<string, string> = {
  Leader: "bg-emerald-100 text-emerald-700",
  Adopter: "bg-indigo-100 text-indigo-700",
  Explorer: "bg-amber-100 text-amber-700",
};

function TierPill({ tier }: { tier: string }) {
  if (!tier) return <span className="text-zinc-300">—</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        TIER_TONE[tier] || "bg-zinc-100 text-zinc-700",
      )}
    >
      {tier}
    </span>
  );
}

function editionLabel(e: string): string {
  return e === "scaling-up" ? "Scaling Up" : e === "caio" ? "CAIO" : "";
}

function SourcePill({ edition }: { edition: string }) {
  const label = editionLabel(edition);
  if (!label) return <span className="text-zinc-300">—</span>;
  const su = edition === "scaling-up";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        su ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700",
      )}
    >
      {label}
    </span>
  );
}

// "Booked a call" pill — set from the GHL booking webhook. Emerald + a check so
// it reads as a hot, positive signal at a glance.
function BookedPill({ lead }: { lead: Pick<AssessmentLead, "bookedCalendar" | "bookedAt"> }) {
  const parts = [
    "Booked a call",
    lead.bookedCalendar,
    lead.bookedAt ? `on ${fmtDate(lead.bookedAt)}` : "",
  ].filter(Boolean);
  return (
    <span
      title={parts.join(" · ")}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
    >
      <Check className="h-3 w-3" />
      Booked
    </span>
  );
}

// ─── Test / internal detection (mirrors the quiz portal) ──────────────────────
const TEST_DOMAINS = ["chiefaiofficer.com", "scalingup.com", "123.com"];
const TEST_NAMES = [
  "daniel neefe",
  "dani test",
  "anna rozhko",
  "anna broome",
  "chris daigle",
  "cedric kato",
];
function isTestLead(l: Pick<AssessmentLead, "name" | "email">): boolean {
  const email = (l.email || "").toLowerCase().trim();
  const name = (l.name || "").toLowerCase().trim();
  const domain = email.split("@")[1] || "";
  if (TEST_DOMAINS.includes(domain)) return true;
  if (/\btest\b/.test(name) || /test/.test(email)) return true;
  if (name.includes("neefe")) return true;
  return TEST_NAMES.some((n) => name.includes(n));
}

function fmtDate(v: string): string {
  if (!v) return "—";
  try {
    return format(new Date(v), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LeadsPageClient() {
  const [leads, setLeads] = useState<AssessmentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");

  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState("");
  const [tier, setTier] = useState("");
  const [hideTests, setHideTests] = useState(false);
  const [bookedOnly, setBookedOnly] = useState(false);
  const [selected, setSelected] = useState<AssessmentLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load leads (${res.status}).`);
      }
      const data = (await res.json()) as {
        leads: AssessmentLead[];
        fetchedAt: string;
      };
      setLeads(data.leads || []);
      setFetchedAt(data.fetchedAt || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (hideTests && isTestLead(l)) return false;
      if (bookedOnly && !l.bookedCall) return false;
      if (edition && l.edition !== edition) return false;
      if (tier && l.tier !== tier) return false;
      if (!q) return true;
      return [l.name, l.email, l.company, l.role, l.industry].some(
        (v) => v && v.toLowerCase().includes(q),
      );
    });
  }, [leads, query, edition, tier, hideTests, bookedOnly]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            AI Readiness assessment leads from ChiefAIOfficer.com — both CAIO and
            Scaling Up editions. Click a row for the full profile and answers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw
              className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, company, role, industry…"
            className="pl-9"
          />
        </div>
        <select
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          <option value="scaling-up">Scaling Up</option>
          <option value="caio">CAIO</option>
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          aria-label="Filter by tier"
        >
          <option value="">All tiers</option>
          <option value="Leader">Leader</option>
          <option value="Adopter">Adopter</option>
          <option value="Explorer">Explorer</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
          <input
            type="checkbox"
            checked={hideTests}
            onChange={(e) => setHideTests(e.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-600"
          />
          Hide test entries
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
          <input
            type="checkbox"
            checked={bookedOnly}
            onChange={(e) => setBookedOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-600"
          />
          Booked a call
        </label>
        <span className="ml-auto text-xs text-zinc-400">
          {loading
            ? "Loading…"
            : `${filtered.length}${filtered.length !== leads.length ? ` of ${leads.length}` : ""} lead${leads.length === 1 ? "" : "s"}`}
          {fetchedAt && !loading && (
            <> · updated {format(new Date(fetchedAt), "h:mm a")}</>
          )}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name / Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead className="text-right">Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-zinc-400"
                  >
                    {leads.length === 0
                      ? "No leads yet."
                      : "No leads match those filters."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className="cursor-pointer"
                >
                  <TableCell className="whitespace-nowrap text-zinc-500">
                    {fmtDate(lead.subscribedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lead.name || "—"}</span>
                      {lead.bookedCall && <BookedPill lead={lead} />}
                      {isTestLead(lead) && (
                        <Badge
                          variant="outline"
                          className="border-rose-200 bg-rose-50 text-[10px] uppercase tracking-wide text-rose-600"
                        >
                          Test
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-xs text-zinc-500">
                      {lead.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TierPill tier={lead.tier} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lead.pct ? `${lead.pct}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <SourcePill edition={lead.edition} />
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {lead.company || "—"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-zinc-500">
                    {lead.industry || "—"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.pdfUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(lead.pdfUrl, "_blank")}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        PDF
                      </Button>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeadDialog lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ─── Detail dialog ────────────────────────────────────────────────────────────
function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-zinc-800">
        {value || <span className="text-zinc-300">—</span>}
      </div>
    </div>
  );
}

function LeadDialog({
  lead,
  onClose,
}: {
  lead: AssessmentLead | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {lead && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <TierPill tier={lead.tier} />
                <SourcePill edition={lead.edition} />
                {lead.bookedCall && <BookedPill lead={lead} />}
                {lead.pct && (
                  <span className="text-sm text-zinc-500 tabular-nums">
                    {lead.pct}% readiness
                  </span>
                )}
                {isTestLead(lead) && (
                  <Badge
                    variant="outline"
                    className="border-rose-200 bg-rose-50 text-[10px] uppercase tracking-wide text-rose-600"
                  >
                    Test
                  </Badge>
                )}
              </div>
              <DialogTitle className="mt-1 text-xl">
                {lead.name || "Unnamed lead"}
              </DialogTitle>
              <a
                href={`mailto:${lead.email}`}
                className="font-mono text-sm text-indigo-600 hover:underline"
              >
                {lead.email}
              </a>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField label="Company" value={lead.company} />
                <DetailField label="Role" value={lead.role} />
                <DetailField label="Industry" value={lead.industry} />
                <DetailField label="Company Size" value={lead.companySize} />
                <DetailField label="Submitted" value={fmtDate(lead.subscribedAt)} />
                <DetailField
                  label="Source"
                  value={
                    [editionLabel(lead.edition), lead.utmSource, lead.utmCampaign]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
                <DetailField
                  label="Booked call"
                  value={
                    lead.bookedCall
                      ? [
                          "Yes",
                          lead.bookedCalendar,
                          lead.bookedAt ? fmtDate(lead.bookedAt) : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : undefined
                  }
                />
              </div>

              {(lead.primaryGoal || lead.biggestChallenge || lead.aiTools) && (
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Personalisation
                  </div>
                  <DetailField label="Primary AI Goals" value={lead.primaryGoal} />
                  <DetailField
                    label="Biggest Challenge"
                    value={lead.biggestChallenge}
                  />
                  <DetailField label="AI Tools in Use" value={lead.aiTools} />
                </div>
              )}

              <div>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Assessment answers{" "}
                  {lead.answers.length > 0 && `(${lead.answers.length})`}
                </div>
                {lead.answers.length > 0 ? (
                  <ol className="space-y-2.5">
                    {lead.answers.map((qa, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold tabular-nums text-zinc-500">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm leading-snug text-zinc-600">
                            {qa.question}
                          </div>
                          <div className="mt-0.5 text-sm font-medium text-zinc-900">
                            {qa.answer}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No detailed answers on file — this lead predates answer
                    capture.
                  </p>
                )}
              </div>

              {lead.pdfUrl && (
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => window.open(lead.pdfUrl, "_blank")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Open Full Report (PDF)
                    <ExternalLink className="ml-2 h-3.5 w-3.5 text-zinc-400" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

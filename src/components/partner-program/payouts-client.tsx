"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Wallet,
  Calculator,
  PlayCircle,
  Download,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types (shapes returned by /api/partners/payouts/*) ──────────────────

interface BatchRow {
  id: string;
  periodYyyymm: number;
  status: string;
  totalCents: number;
  generatedAt: string;
  paidAt: string | null;
}

interface IncludedLine {
  partnerId: string;
  name: string;
  email: string;
  company: string | null;
  payoutMethod: string;
  taxFormStatus: string;
  amountCents: number;
  conversionIds: string[];
}

interface ExcludedLine {
  partnerId: string;
  name: string;
  email: string;
  company: string | null;
  payoutMethod: string;
  taxFormStatus: string;
  amountCents: number;
  reason: string;
}

interface PreviewResponse {
  minPayoutCents: number;
  included: IncludedLine[];
  excluded: ExcludedLine[];
  totalCents: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** 202606 → "Jun 2026". */
function fmtPeriod(yyyymm: number): string {
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  if (m < 1 || m > 12) return String(yyyymm);
  return format(new Date(y, m - 1, 1), "MMM yyyy");
}

const EXCLUDE_REASON_LABEL: Record<string, string> = {
  under_threshold: "Under minimum",
  tax_form_invalid: "Tax form invalid",
  partner_not_active: "Partner not active",
  non_positive_balance: "No positive balance",
};
function excludeReasonLabel(reason: string): string {
  return EXCLUDE_REASON_LABEL[reason] ?? reason.replace(/_/g, " ");
}

const TAX_FORM_LABEL: Record<string, string> = {
  none: "None",
  w9: "W-9",
  w8ben: "W-8BEN",
  w8bene: "W-8BEN-E",
  invalid: "Invalid",
};
function taxFormLabel(s: string): string {
  return TAX_FORM_LABEL[s] ?? s;
}

function payoutMethodLabel(s: string): string {
  if (s === "ach") return "ACH";
  if (s === "zelle") return "Zelle";
  return "—";
}

function BatchStatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : status === "exported"
      ? "bg-sky-100 text-sky-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        tone,
      )}
    >
      {status}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PayoutsClient({
  initialBatches,
}: {
  initialBatches: BatchRow[];
}) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Mark-paid confirm dialog state
  const [markTarget, setMarkTarget] = useState<BatchRow | null>(null);
  const [marking, setMarking] = useState(false);

  const loadPreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch("/api/partners/payouts/preview");
      if (!res.ok) {
        toast.error("Failed to load payout preview");
        return;
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
    } catch {
      toast.error("Failed to load payout preview");
    } finally {
      setPreviewing(false);
    }
  };

  const generateBatch = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/partners/payouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        toast.error("Failed to generate batch");
        return;
      }
      const data = (await res.json()) as {
        batchId: string;
        totalCents: number;
        lines: { partnerId: string }[];
      };
      const count = data.lines.length;
      toast.success(
        `Batch generated — ${count} partner${count === 1 ? "" : "s"}, ${fmtUsd(
          data.totalCents,
        )}`,
      );
      setPreview(null);
      router.refresh();
    } catch {
      toast.error("Failed to generate batch");
    } finally {
      setGenerating(false);
    }
  };

  const confirmMarkPaid = async () => {
    if (!markTarget) return;
    setMarking(true);
    try {
      const res = await fetch(
        `/api/partners/payouts/${markTarget.id}/mark-paid`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error("Failed to mark batch paid");
        return;
      }
      const data = (await res.json()) as { conversionsPaid: number };
      setBatches((prev) =>
        prev.map((b) =>
          b.id === markTarget.id
            ? { ...b, status: "paid", paidAt: new Date().toISOString() }
            : b,
        ),
      );
      toast.success(
        `Marked paid — ${data.conversionsPaid} conversion${
          data.conversionsPaid === 1 ? "" : "s"
        } settled`,
      );
      setMarkTarget(null);
      router.refresh();
    } catch {
      toast.error("Failed to mark batch paid");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Preview the next partner payout run, generate a batch, then export
            and mark it paid. Net-45 terms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPreview}
            disabled={previewing}
          >
            {previewing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-3.5 w-3.5" />
            )}
            Preview payout
          </Button>
          <Button size="sm" onClick={generateBatch} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-3.5 w-3.5" />
            )}
            Generate batch
          </Button>
        </div>
      </div>

      {/* Preview card */}
      {preview && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Payout preview</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {fmtUsd(preview.minPayoutCents)} minimum — balances below this
                roll forward to the next run.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Total
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {fmtUsd(preview.totalCents)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Included */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Included ({preview.included.length})
                </h3>
              </div>
              {preview.included.length === 0 ? (
                <div className="rounded-md border border-dashed py-8 text-center text-sm text-zinc-500">
                  No partners qualify for this run yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Partner</th>
                        <th className="px-3 py-2 text-left">Method</th>
                        <th className="px-3 py-2 text-left">Tax form</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.included.map((p) => (
                        <tr key={p.partnerId} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium text-zinc-900">
                              {p.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {p.company ? `${p.company} · ` : ""}
                              {p.email}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {payoutMethodLabel(p.payoutMethod)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-600">
                            {taxFormLabel(p.taxFormStatus)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {fmtUsd(p.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-zinc-50">
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-zinc-500"
                        >
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {fmtUsd(preview.totalCents)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Excluded */}
            {preview.excluded.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Rolling forward ({preview.excluded.length})
                  </h3>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Partner</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.excluded.map((p) => (
                        <tr key={p.partnerId} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium text-zinc-900">
                              {p.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {p.email}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                            {fmtUsd(p.amountCents)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {excludeReasonLabel(p.reason)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batches table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              No payout batches yet. Preview the run, then generate your first
              batch.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Generated</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        {fmtPeriod(b.periodYyyymm)}
                      </td>
                      <td className="px-3 py-2">
                        <BatchStatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {fmtUsd(b.totalCents)}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {format(parseISO(b.generatedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/partners/payouts/${b.id}/export`}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export CSV
                          </a>
                          {b.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMarkTarget(b)}
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Mark paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark-paid confirm dialog */}
      <Dialog
        open={!!markTarget}
        onOpenChange={(o) => {
          if (!o && !marking) setMarkTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark batch paid?</DialogTitle>
            <DialogDescription>
              {markTarget && (
                <>
                  This marks the {fmtPeriod(markTarget.periodYyyymm)} batch (
                  {fmtUsd(markTarget.totalCents)}) as paid and settles its
                  conversions. This can&apos;t be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkTarget(null)}
              disabled={marking}
            >
              Cancel
            </Button>
            <Button onClick={confirmMarkPaid} disabled={marking}>
              {marking ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              )}
              Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

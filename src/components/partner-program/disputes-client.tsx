"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale } from "lucide-react";
import { format, parseISO, isValid as dateIsValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface DisputeRow {
  id: string;
  partnerId: string;
  partnerName: string | null;
  partnerEmail: string | null;
  conversionId: string | null;
  submittedAt: string;
  dealCloseDate: string | null;
  evidence: string | null;
  status: string;
  resolution: string | null;
  decidedAt: string | null;
  isSample: boolean;
}

export interface ProgramOption {
  id: string;
  name: string;
  listValueCents: number;
}

type Decision = "upheld" | "denied" | "closed";

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  upheld: "bg-emerald-100 text-emerald-700",
  denied: "bg-zinc-200 text-zinc-700",
  closed: "bg-zinc-200 text-zinc-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_TONE[status] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {status}
    </span>
  );
}

function SampleBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
      SAMPLE ONLY
    </span>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    const parsed = parseISO(d);
    return dateIsValid(parsed) ? format(parsed, "MMM d, yyyy") : "—";
  } catch {
    return "—";
  }
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

export function DisputesClient({
  initialDisputes,
  programs,
}: {
  initialDisputes: DisputeRow[];
  programs: ProgramOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialDisputes);
  const [active, setActive] = useState<DisputeRow | null>(null);
  const [decision, setDecision] = useState<Decision>("upheld");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditProgramId, setCreditProgramId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  const openCount = rows.filter((r) => r.status === "open").length;

  const openDialog = (r: DisputeRow) => {
    setActive(r);
    setDecision("upheld");
    setResolution(r.resolution ?? "");
    setCreditProgramId("");
    setCreditAmount("");
  };

  const handleDecide = async () => {
    if (!active) return;

    const payload: {
      status: Decision;
      resolution: string | null;
      creditProgramId?: string;
      creditGrossCents?: number;
    } = { status: decision, resolution: resolution || null };

    // Inline credit is only offered when upholding with a program + amount.
    let creditedCents: number | null = null;
    if (decision === "upheld" && creditProgramId && creditAmount.trim()) {
      const dollars = Number(creditAmount);
      if (!Number.isFinite(dollars) || dollars < 0) {
        toast.error("Enter a valid credit amount");
        return;
      }
      creditedCents = Math.round(dollars * 100);
      payload.creditProgramId = creditProgramId;
      payload.creditGrossCents = creditedCents;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/partners/disputes/${active.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to record decision");
        return;
      }
      const { dispute } = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                status: dispute.status,
                resolution: dispute.resolution ?? null,
                decidedAt: dispute.decidedAt ?? new Date().toISOString(),
              }
            : r,
        ),
      );
      toast.success(
        creditedCents != null
          ? `Dispute upheld — commission credited`
          : `Dispute marked ${decision}`,
      );
      setActive(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Partner Disputes
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Attribution disputes filed by partners. Review the evidence and
            record a decision within the dispute window.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Open
              </div>
              <div
                className={cn(
                  "mt-0.5 text-xl font-semibold tabular-nums",
                  openCount > 0 && "text-amber-700",
                )}
              >
                {openCount}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Queue */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            No disputes have been filed.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2">Partner</th>
                  <th className="text-left px-3 py-2">Conversion</th>
                  <th className="text-left px-3 py-2">Submitted</th>
                  <th className="text-left px-3 py-2">Deal Close</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDialog(r)}
                    className="cursor-pointer border-t hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2 font-medium text-zinc-900">
                        <span>{r.partnerName || "Unknown partner"}</span>
                        {r.isSample && <SampleBadge />}
                      </div>
                      {r.partnerEmail && (
                        <div className="text-xs font-mono text-zinc-500">
                          {r.partnerEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs text-zinc-600">
                      {shortId(r.conversionId)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-600">
                      {fmtDate(r.submittedAt)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-600">
                      {fmtDate(r.dealCloseDate)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Decision dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review dispute</DialogTitle>
            <DialogDescription>
              {active?.partnerName || "Unknown partner"} ·{" "}
              {active?.partnerEmail || "—"}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="uppercase tracking-wide text-zinc-500">
                    Conversion
                  </div>
                  <div className="mt-0.5 font-mono text-zinc-700">
                    {shortId(active.conversionId)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-zinc-500">
                    Deal close
                  </div>
                  <div className="mt-0.5 text-zinc-700">
                    {fmtDate(active.dealCloseDate)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-zinc-500">
                    Submitted
                  </div>
                  <div className="mt-0.5 text-zinc-700">
                    {fmtDate(active.submittedAt)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-zinc-500">
                    Current status
                  </div>
                  <div className="mt-0.5">
                    <StatusBadge status={active.status} />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-zinc-500">
                  Evidence
                </Label>
                <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
                  {active.evidence || (
                    <span className="text-zinc-400">No evidence provided.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decision">Decision</Label>
                <Select
                  value={decision}
                  onValueChange={(v) => setDecision(v as Decision)}
                >
                  <SelectTrigger id="decision">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upheld">Upheld</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Textarea
                  id="resolution"
                  placeholder="Explain the decision and any actions taken…"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                />
              </div>

              {decision === "upheld" && (
                <div className="space-y-3 rounded-md border border-indigo-100 bg-indigo-50/50 p-3">
                  <div>
                    <Label className="text-sm font-medium text-zinc-800">
                      Credit this affiliate{" "}
                      <span className="font-normal text-zinc-500">
                        (optional)
                      </span>
                    </Label>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Creates an earned commission that appears in Events and the
                      next payout — no manual entry needed.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="credit-program"
                        className="text-xs uppercase tracking-wide text-zinc-500"
                      >
                        Program
                      </Label>
                      <Select
                        value={creditProgramId}
                        onValueChange={(v) => setCreditProgramId(v ?? "")}
                      >
                        <SelectTrigger id="credit-program">
                          <SelectValue placeholder="Select a program…" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="credit-amount"
                        className="text-xs uppercase tracking-wide text-zinc-500"
                      >
                        Gross amount ($)
                      </Label>
                      <Input
                        id="credit-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActive(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleDecide} disabled={saving}>
              {saving ? "Saving…" : "Record decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

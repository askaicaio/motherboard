"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Search,
  Plus,
  ChevronDown,
  Filter,
} from "lucide-react";
import { format, parseISO, isValid as dateIsValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

type ConversionStatus =
  | "pending"
  | "earned"
  | "paid"
  | "reversed"
  | "rejected";

export interface ConversionRow {
  id: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerRefCode: string | null;
  attributionEventId: string | null;
  buyerEmail: string;
  programId: string;
  programName: string;
  grossCents: number;
  feesCents: number;
  nonCommissionableCents: number;
  commissionableCents: number;
  commissionCents: number;
  currency: string;
  externalOrderId: string | null;
  source: string;
  purchasedAt: string | null;
  isNewCustomer: boolean;
  status: ConversionStatus;
  refundWindowEndsAt: string | null;
  disputeWindowEndsAt: string | null;
  earnedAt: string | null;
  rejectReason: string | null;
  publicRejectReason: string | null;
  createdAt: string;
}

interface PartnerOption {
  id: string;
  name: string;
  refCode: string;
}
interface ProgramOption {
  id: string;
  name: string;
  salesLed: boolean;
}

type StatusFilter = "all" | ConversionStatus;

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "pending",
  "earned",
  "paid",
  "reversed",
  "rejected",
];

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtUsd(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (!dateIsValid(d)) return "—";
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

const STATUS_TONE: Record<ConversionStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  earned: "bg-emerald-100 text-emerald-700",
  paid: "bg-indigo-100 text-indigo-700",
  reversed: "bg-zinc-200 text-zinc-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: ConversionStatus }) {
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ConversionsClient({
  initialRows,
  partners,
  programs,
}: {
  initialRows: ConversionRow[];
  partners: PartnerOption[];
  programs: ProgramOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detail, setDetail] = useState<ConversionRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const haystack = [
          r.buyerEmail,
          r.programName,
          r.partnerName,
          r.externalOrderId,
          r.rejectReason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter]);

  // Aggregate stats over the filtered view
  const stats = useMemo(() => {
    const gross = filtered.reduce((s, r) => s + r.grossCents, 0);
    const commission = filtered.reduce((s, r) => s + r.commissionCents, 0);
    const unmatched = filtered.filter((r) => !r.partnerId).length;
    return { count: filtered.length, gross, commission, unmatched };
  }, [filtered]);

  const upsertRow = (updated: ConversionRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetail((d) => (d && d.id === updated.id ? updated : d));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Conversions
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Partner conversion queue — review, match, reject, and resolve
            commissions.
          </p>
        </div>
        <Button size="sm" onClick={() => setManualOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Manual entry
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Visible" value={String(stats.count)} />
        <SummaryCard label="Gross" value={fmtUsd(stats.gross)} />
        <SummaryCard label="Commission" value={fmtUsd(stats.commission)} />
        <SummaryCard
          label="Unmatched"
          value={String(stats.unmatched)}
          highlight={stats.unmatched > 0}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search buyer, program, partner, reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <Filter className="mr-1 h-3.5 w-3.5" />
            Status:{" "}
            <span className="capitalize">
              {statusFilter === "all" ? "All" : statusFilter}
            </span>
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_FILTERS.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  setStatusFilter(s);
                }}
                className="capitalize"
              >
                {statusFilter === s ? "✓ " : "  "}
                {s === "all" ? "All" : s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            No conversions match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2">Buyer</th>
                  <th className="text-left px-3 py-2">Program</th>
                  <th className="text-left px-3 py-2">Partner</th>
                  <th className="text-right px-3 py-2">Gross</th>
                  <th className="text-right px-3 py-2">Commission</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Purchased</th>
                  <th className="text-left px-3 py-2">Reject reason</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="cursor-pointer border-t hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2 align-top font-mono text-xs text-zinc-700 max-w-[200px] truncate">
                      {r.buyerEmail}
                    </td>
                    <td className="px-3 py-2 align-top">{r.programName}</td>
                    <td className="px-3 py-2 align-top">
                      {r.partnerName ?? (
                        <span className="text-zinc-400">— unmatched</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      {fmtUsd(r.grossCents)}
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      {fmtUsd(r.commissionCents)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-600">
                      {fmtDate(r.purchasedAt)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-500 max-w-[200px] truncate">
                      {r.rejectReason || (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <ConversionDetailDialog
        row={detail}
        partners={partners}
        onOpenChange={(o) => !o && setDetail(null)}
        onUpdated={(updated) => {
          upsertRow(updated);
          router.refresh();
        }}
      />

      {/* Manual entry dialog */}
      <ManualEntryDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        programs={programs}
        partners={partners}
        onCreated={() => {
          setManualOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            highlight && "text-amber-700",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail dialog ────────────────────────────────────────────────────────────

function MoneyRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="tabular-nums font-medium">{fmtUsd(cents)}</span>
    </div>
  );
}

function ConversionDetailDialog({
  row,
  partners,
  onOpenChange,
  onUpdated,
}: {
  row: ConversionRow | null;
  partners: PartnerOption[];
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: ConversionRow) => void;
}) {
  const [matchOpen, setMatchOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  if (!row) return null;

  const isUnmatched =
    row.status === "rejected" && row.rejectReason === "unmatched";

  return (
    <>
      <Dialog open={!!row} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conversion detail</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {row.buyerEmail}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {/* Money breakdown */}
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Money breakdown
              </div>
              <MoneyRow label="Gross" cents={row.grossCents} />
              <MoneyRow label="Fees" cents={row.feesCents} />
              <MoneyRow
                label="Non-commissionable"
                cents={row.nonCommissionableCents}
              />
              <MoneyRow label="Commissionable" cents={row.commissionableCents} />
              <div className="mt-1 border-t pt-1">
                <MoneyRow label="Commission" cents={row.commissionCents} />
              </div>
            </div>

            {/* Attribution */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field
                label="Program"
                value={row.programName}
              />
              <Field
                label="Partner"
                value={row.partnerName ?? "— unmatched"}
              />
              <Field
                label="Status"
                value={<StatusBadge status={row.status} />}
              />
              <Field label="Source" value={row.source} />
              <Field
                label="New customer"
                value={row.isNewCustomer ? "Yes" : "No"}
              />
              <Field
                label="External order"
                value={row.externalOrderId || "—"}
              />
              <Field label="Purchased" value={fmtDate(row.purchasedAt)} />
              <Field label="Earned" value={fmtDate(row.earnedAt)} />
              <Field
                label="Refund window ends"
                value={fmtDate(row.refundWindowEndsAt)}
              />
              <Field
                label="Dispute window ends"
                value={fmtDate(row.disputeWindowEndsAt)}
              />
            </div>

            {(row.rejectReason || row.publicRejectReason) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
                {row.rejectReason && (
                  <div>
                    <span className="font-medium text-red-700">Reason:</span>{" "}
                    {row.rejectReason}
                  </div>
                )}
                {row.publicRejectReason && (
                  <div className="mt-1">
                    <span className="font-medium text-red-700">Public:</span>{" "}
                    {row.publicRejectReason}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap">
            {isUnmatched && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMatchOpen(true)}
              >
                Match to partner
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResolveOpen(true)}
            >
              Resolve partial refund
            </Button>
            {row.status !== "rejected" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        row={row}
        partners={partners}
        onDone={(updated) => {
          setMatchOpen(false);
          onUpdated(updated);
        }}
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        row={row}
        onDone={(updated) => {
          setRejectOpen(false);
          onUpdated(updated);
        }}
      />
      <ResolvePartialRefundDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        row={row}
        onDone={(updated) => {
          setResolveOpen(false);
          onUpdated(updated);
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="text-sm text-zinc-800">{value}</div>
    </div>
  );
}

// ─── Match dialog ─────────────────────────────────────────────────────────────

function MatchDialog({
  open,
  onOpenChange,
  row,
  partners,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: ConversionRow;
  partners: PartnerOption[];
  onDone: (updated: ConversionRow) => void;
}) {
  const [partnerId, setPartnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!partnerId) {
      toast.error("Pick a partner");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/partners/conversions/${row.id}/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to match");
        return;
      }
      const partner = partners.find((p) => p.id === partnerId);
      onDone({
        ...row,
        partnerId,
        partnerName: partner?.name ?? row.partnerName,
        partnerRefCode: partner?.refCode ?? row.partnerRefCode,
        status: data.conversion?.status ?? "pending",
        rejectReason: data.conversion?.rejectReason ?? null,
        publicRejectReason: data.conversion?.publicRejectReason ?? null,
      });
      toast.success("Matched to partner");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Match to partner</DialogTitle>
          <DialogDescription>
            Assign this conversion to a partner. If it was rejected as
            unmatched it will move back to pending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="match-partner">Partner</Label>
          <select
            id="match-partner"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Select a partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.refCode})
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Matching…" : "Match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  open,
  onOpenChange,
  row,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: ConversionRow;
  onDone: (updated: ConversionRow) => void;
}) {
  const [reason, setReason] = useState("");
  const [publicReason, setPublicReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/partners/conversions/${row.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rejectReason: reason.trim(),
            publicRejectReason: publicReason.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to reject");
        return;
      }
      onDone({
        ...row,
        status: "rejected",
        rejectReason: reason.trim(),
        publicRejectReason: publicReason.trim() || null,
      });
      toast.success("Conversion rejected");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject conversion</DialogTitle>
          <DialogDescription>
            The internal reason is logged; the public reason is shown to the
            partner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reject-reason">Internal reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. duplicate of existing conversion"
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reject-public">Public reason (optional)</Label>
            <Textarea
              id="reject-public"
              value={publicReason}
              onChange={(e) => setPublicReason(e.target.value)}
              placeholder="Shown to the partner"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Resolve partial refund dialog ────────────────────────────────────────────

function ResolvePartialRefundDialog({
  open,
  onOpenChange,
  row,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: ConversionRow;
  onDone: (updated: ConversionRow) => void;
}) {
  const [adjusted, setAdjusted] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const trimmed = adjusted.trim();
      const adjustedCommissionCents =
        trimmed === ""
          ? undefined
          : Math.round(parseFloat(trimmed) * 100);
      if (
        adjustedCommissionCents !== undefined &&
        !Number.isFinite(adjustedCommissionCents)
      ) {
        toast.error("Enter a valid dollar amount");
        setSubmitting(false);
        return;
      }
      const res = await fetch(
        `/api/partners/conversions/${row.id}/resolve-partial-refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            adjustedCommissionCents === undefined
              ? {}
              : { adjustedCommissionCents },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to resolve");
        return;
      }
      onDone({
        ...row,
        commissionCents:
          adjustedCommissionCents !== undefined
            ? adjustedCommissionCents
            : row.commissionCents,
      });
      toast.success("Partial refund resolved");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve partial refund</DialogTitle>
          <DialogDescription>
            Clears the promotion hold on this conversion. Optionally override
            the commission amount (in USD).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="adjusted-commission">
            Adjusted commission (USD, optional)
          </Label>
          <Input
            id="adjusted-commission"
            type="number"
            step="0.01"
            min="0"
            value={adjusted}
            onChange={(e) => setAdjusted(e.target.value)}
            placeholder={`Current: ${fmtUsd(row.commissionCents)}`}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Resolving…" : "Resolve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual entry dialog ──────────────────────────────────────────────────────

function ManualEntryDialog({
  open,
  onOpenChange,
  programs,
  partners,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programs: ProgramOption[];
  partners: PartnerOption[];
  onCreated: () => void;
}) {
  const [buyerEmail, setBuyerEmail] = useState("");
  const [programRef, setProgramRef] = useState("");
  const [gross, setGross] = useState("");
  const [fees, setFees] = useState("");
  const [nonComm, setNonComm] = useState("");
  const [purchasedAt, setPurchasedAt] = useState("");
  const [affId, setAffId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBuyerEmail("");
    setProgramRef("");
    setGross("");
    setFees("");
    setNonComm("");
    setPurchasedAt("");
    setAffId("");
  };

  const toCents = (v: string): number => {
    const n = parseFloat(v.trim());
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const submit = async () => {
    if (!buyerEmail.trim()) {
      toast.error("Buyer email is required");
      return;
    }
    if (!programRef) {
      toast.error("Pick a program");
      return;
    }
    const grossCents = toCents(gross);
    if (grossCents <= 0) {
      toast.error("Enter a valid gross amount");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        buyerEmail: buyerEmail.trim(),
        programRef,
        grossCents,
        feesCents: fees.trim() ? toCents(fees) : 0,
        nonCommissionableCents: nonComm.trim() ? toCents(nonComm) : 0,
        currency: "USD",
      };
      if (purchasedAt) {
        body.purchasedAt = new Date(purchasedAt).toISOString();
      }
      if (affId) body.affId = affId;

      const res = await fetch("/api/partners/manual-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create conversion");
        return;
      }
      toast.success("Manual conversion created");
      reset();
      onCreated();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual conversion entry</DialogTitle>
          <DialogDescription>
            Record a sales-led deal or correction. Amounts are in USD.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="manual-buyer">Buyer email</Label>
            <Input
              id="manual-buyer"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="buyer@company.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-program">Program</Label>
            <select
              id="manual-program"
              value={programRef}
              onChange={(e) => setProgramRef(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Select a program…</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.salesLed ? " (sales-led)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="manual-gross">Gross ($)</Label>
              <Input
                id="manual-gross"
                type="number"
                step="0.01"
                min="0"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-fees">Fees ($)</Label>
              <Input
                id="manual-fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-noncomm">Non-comm. ($)</Label>
              <Input
                id="manual-noncomm"
                type="number"
                step="0.01"
                min="0"
                value={nonComm}
                onChange={(e) => setNonComm(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-date">Purchased at (optional)</Label>
            <Input
              id="manual-date"
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-aff">Partner (optional)</Label>
            <select
              id="manual-aff"
              value={affId}
              onChange={(e) => setAffId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Email-match (no explicit partner)</option>
              {partners.map((p) => (
                <option key={p.id} value={p.refCode}>
                  {p.name} ({p.refCode})
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// =============================================================
// Unified "Events" pipeline — attribution → conversion → payout.
// Merges the old Attribution, Conversions, and Payouts surfaces into one
// segmented view:
//   • Activity     — the conversions ledger with a STATUS lifecycle column
//                    (pending → earned → paid, plus reversed/rejected).
//   • Attribution  — direct-intro / tracked-link log + "Record introduction".
//   • Payouts      — batch history + "Generate payout batch" + "Mark paid".
// All actions reuse the existing /api/partners/* endpoints.
// =============================================================

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  GitBranch,
  Wallet,
  Search,
  Plus,
  Filter,
  ChevronDown,
  Check,
  X,
  Link2,
  UserPlus,
  Calculator,
  PlayCircle,
  Download,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { format, parseISO, isValid as dateIsValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Shared types ─────────────────────────────────────────────────────────

type ConversionStatus = "pending" | "earned" | "paid" | "reversed" | "rejected";

export interface ConversionRow {
  id: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerRefCode: string | null;
  partnerIsSample: boolean;
  isSample: boolean;
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

export interface AttributionEventItem {
  id: string;
  partnerId: string;
  partnerName: string | null;
  partnerIsSample: boolean;
  type: string;
  prospectEmail: string | null;
  prospectName: string | null;
  company: string | null;
  sourceDetail: string | null;
  recordedAt: string;
  proposalSentAt: string | null;
  isValid: boolean;
  notes: string | null;
}

export interface BatchRow {
  id: string;
  periodYyyymm: number;
  status: string;
  totalCents: number;
  generatedAt: string;
  paidAt: string | null;
}

export interface PartnerOption {
  id: string;
  name: string;
  refCode: string;
  isSample: boolean;
}
export interface ProgramOption {
  id: string;
  name: string;
  salesLed: boolean;
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

// ─── Formatting helpers ───────────────────────────────────────────────────

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

/** 202606 → "Jun 2026". */
function fmtPeriod(yyyymm: number): string {
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  if (m < 1 || m > 12) return String(yyyymm);
  return format(new Date(y, m - 1, 1), "MMM yyyy");
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

/** Small amber pill flagging a seeded/demo row. */
function SampleBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      SAMPLE ONLY
    </span>
  );
}

// ─── Searchable partner combobox ──────────────────────────────────────────
// Type-to-search picker over the affiliate list. Filters case-insensitively
// on name + ref code, keyboard-navigable (cmdk). `value`/`onChange` carry
// whatever id the caller keys on (partnerId or refCode), plus an optional
// "no explicit partner" sentinel rendered as the first row.

function PartnerCombobox({
  partners,
  value,
  onChange,
  valueKey = "id",
  placeholder = "Select a partner…",
  emptyOption,
  id,
}: {
  partners: PartnerOption[];
  value: string;
  onChange: (value: string) => void;
  /** Which field of PartnerOption is used as the selected value. */
  valueKey?: "id" | "refCode";
  placeholder?: string;
  /** Optional first row representing "no explicit partner" (its value is ""). */
  emptyOption?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected =
    value === ""
      ? null
      : partners.find((p) => (valueKey === "id" ? p.id : p.refCode) === value);

  const triggerLabel =
    value === ""
      ? emptyOption ?? placeholder
      : selected
        ? `${selected.name} (${selected.refCode})`
        : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-sm",
          value === "" && !emptyOption && "text-zinc-400",
        )}
      >
        <span className="flex min-w-0 items-center truncate">
          <span className="truncate">{triggerLabel}</span>
          {selected?.isSample && <SampleBadge />}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search name or ref code…" />
          <CommandList>
            <CommandEmpty>No partners found.</CommandEmpty>
            <CommandGroup>
              {emptyOption && (
                <CommandItem
                  value={emptyOption}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {emptyOption}
                </CommandItem>
              )}
              {partners.map((p) => {
                const optValue = valueKey === "id" ? p.id : p.refCode;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.refCode}`}
                    onSelect={() => {
                      onChange(optValue);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">
                      {p.name}{" "}
                      <span className="text-zinc-400">({p.refCode})</span>
                    </span>
                    {p.isSample && <SampleBadge />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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

// datetime-local wants "yyyy-MM-dd'T'HH:mm" in LOCAL time.
function nowLocalInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

// ─── Root component ────────────────────────────────────────────────────────

type Section = "activity" | "attribution" | "payouts";

const SECTIONS: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "attribution", label: "Attribution", icon: GitBranch },
  { id: "payouts", label: "Payouts", icon: Wallet },
];

export function EventsClient({
  initialConversions,
  initialEvents,
  initialBatches,
  partners,
  programs,
}: {
  initialConversions: ConversionRow[];
  initialEvents: AttributionEventItem[];
  initialBatches: BatchRow[];
  partners: PartnerOption[];
  programs: ProgramOption[];
}) {
  const [section, setSection] = useState<Section>("activity");

  const pendingCount = useMemo(
    () => initialConversions.filter((c) => c.status === "pending").length,
    [initialConversions],
  );
  const unbatchedBatches = useMemo(
    () => initialBatches.filter((b) => b.status !== "paid").length,
    [initialBatches],
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          The unified affiliate pipeline — attribution, conversions, and
          payouts in one place.
        </p>
      </div>

      {/* Automation banner */}
      <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
        <p>
          <span className="font-medium">
            Attribution → conversion → earned is automatic.
          </span>{" "}
          You only act on exceptions — manual sales-led entries, disputes — and
          on releasing payouts.
        </p>
      </div>

      {/* Segmented control */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          const badge =
            id === "activity" && pendingCount > 0
              ? pendingCount
              : id === "payouts" && unbatchedBatches > 0
                ? unbatchedBatches
                : undefined;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {badge !== undefined && (
                <span className="ml-0.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {section === "activity" && (
        <ActivitySection
          initialRows={initialConversions}
          partners={partners}
          programs={programs}
        />
      )}
      {section === "attribution" && (
        <AttributionSection
          initialEvents={initialEvents}
          partners={partners}
        />
      )}
      {section === "payouts" && (
        <PayoutsSection initialBatches={initialBatches} />
      )}
    </div>
  );
}

// =============================================================
// ACTIVITY — conversions ledger with lifecycle status column
// =============================================================

type StatusFilter = "all" | ConversionStatus;
const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "pending",
  "earned",
  "paid",
  "reversed",
  "rejected",
];

function ActivitySection({
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="max-w-2xl text-sm text-zinc-500">
          Every conversion event and where it sits in its lifecycle. Status
          flows{" "}
          <span className="font-medium text-zinc-700">
            pending → earned → paid
          </span>
          ; rejected and reversed are terminal exceptions.
        </p>
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

      {/* Ledger */}
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
                  <th className="text-left px-3 py-2">Affiliate</th>
                  <th className="text-left px-3 py-2">Program</th>
                  <th className="text-left px-3 py-2">Buyer</th>
                  <th className="text-right px-3 py-2">Gross</th>
                  <th className="text-right px-3 py-2">Commission</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Purchased</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="cursor-pointer border-t hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2 align-top">
                      {r.partnerName ? (
                        <span className="inline-flex items-center">
                          {r.partnerName}
                          {(r.partnerIsSample || r.isSample) && <SampleBadge />}
                        </span>
                      ) : (
                        <span className="text-zinc-400">— unmatched</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">{r.programName}</td>
                    <td className="px-3 py-2 align-top font-mono text-xs text-zinc-700 max-w-[200px] truncate">
                      {r.buyerEmail}
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
                    <td className="px-3 py-2 align-top">
                      <RowActionsMenu row={r} onUpdated={upsertRow} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ConversionDetailDialog
        row={detail}
        partners={partners}
        onOpenChange={(o) => !o && setDetail(null)}
        onUpdated={(updated) => {
          upsertRow(updated);
          router.refresh();
        }}
      />

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

/**
 * Per-row "…" actions menu for the Activity ledger. Currently exposes the
 * admin-only "Mark earned now" action, which skips the 7-day refund window
 * for a PENDING conversion (mainly for testing payouts). The item is only
 * enabled for pending rows.
 */
function RowActionsMenu({
  row,
  onUpdated,
}: {
  row: ConversionRow;
  onUpdated: (updated: ConversionRow) => void;
}) {
  const [marking, setMarking] = useState(false);
  const isPending = row.status === "pending";

  const markEarned = async () => {
    setMarking(true);
    try {
      const res = await fetch(
        `/api/partners/conversions/${row.id}/mark-earned`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to mark earned");
        return;
      }
      onUpdated({
        ...row,
        status: "earned",
        earnedAt: data.conversion?.earnedAt ?? new Date().toISOString(),
      });
      toast.success("Conversion marked earned");
    } catch {
      toast.error("Network error");
    } finally {
      setMarking(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 cursor-pointer"
        aria-label="Row actions"
        disabled={marking}
      >
        {marking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          disabled={!isPending || marking}
          onSelect={(e) => {
            e.preventDefault();
            void markEarned();
          }}
        >
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Mark earned now
        </DropdownMenuItem>
        {isPending && (
          <DropdownMenuLabel className="max-w-56 whitespace-normal text-[10px] font-normal leading-snug text-zinc-400">
            Skips the 7-day refund window and moves this conversion straight to
            earned.
          </DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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

function MoneyRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="tabular-nums font-medium">{fmtUsd(cents)}</span>
    </div>
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
  // Reject only makes sense before a conversion reaches a terminal state.
  const isFinalStatus =
    row.status === "paid" ||
    row.status === "reversed" ||
    row.status === "rejected";

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

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Program" value={row.programName} />
              <Field
                label="Affiliate"
                value={
                  row.partnerName ? (
                    <span className="inline-flex items-center">
                      {row.partnerName}
                      {(row.partnerIsSample || row.isSample) && <SampleBadge />}
                    </span>
                  ) : (
                    "— unmatched"
                  )
                }
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
            {!isFinalStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolveOpen(true)}
              >
                Resolve partial refund
              </Button>
            )}
            {!isFinalStatus && (
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
      const res = await fetch(`/api/partners/conversions/${row.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });
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
        partnerIsSample: partner?.isSample ?? row.partnerIsSample,
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
            Assign this conversion to a partner. If it was rejected as unmatched
            it will move back to pending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="match-partner">Partner</Label>
          <PartnerCombobox
            id="match-partner"
            partners={partners}
            value={partnerId}
            onChange={setPartnerId}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
      const res = await fetch(`/api/partners/conversions/${row.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectReason: reason.trim(),
          publicRejectReason: publicReason.trim() || null,
        }),
      });
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
        trimmed === "" ? undefined : Math.round(parseFloat(trimmed) * 100);
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
            Clears the promotion hold on this conversion. Optionally override the
            commission amount (in USD).
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
            <PartnerCombobox
              id="manual-aff"
              partners={partners}
              value={affId}
              onChange={setAffId}
              valueKey="refCode"
              emptyOption="Email-match (no explicit partner)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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

// =============================================================
// ATTRIBUTION — direct-intro / tracked-link log
// =============================================================

function AttributionSection({
  initialEvents,
  partners,
}: {
  initialEvents: AttributionEventItem[];
  partners: PartnerOption[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      return (
        (e.prospectEmail && e.prospectEmail.toLowerCase().includes(q)) ||
        (e.prospectName && e.prospectName.toLowerCase().includes(q)) ||
        (e.partnerName && e.partnerName.toLowerCase().includes(q))
      );
    });
  }, [events, search]);

  const handleCreated = (created: AttributionEventItem) => {
    setEvents((prev) => [created, ...prev]);
    toast.success("Direct introduction recorded");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="max-w-2xl text-sm text-zinc-500">
          Every tracked-link click and logged direct introduction. First valid
          event by recorded time wins attribution (Playbook §13).
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record introduction
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search prospect or partner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prospect email</TableHead>
                <TableHead>Prospect name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>Proposal sent</TableHead>
                <TableHead className="text-center">Valid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-zinc-500"
                  >
                    {events.length === 0
                      ? "No attribution events yet."
                      : "No events match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.partnerName ? (
                        <span className="inline-flex items-center">
                          {e.partnerName}
                          {e.partnerIsSample && <SampleBadge />}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.type === "tracked_link" ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" />
                          Tracked link
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <UserPlus className="h-3 w-3" />
                          Direct intro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.prospectEmail ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.prospectName ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.company ?? <span className="text-zinc-400">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-zinc-600">
                      {format(new Date(e.recordedAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-zinc-600">
                      {e.proposalSentAt ? (
                        format(new Date(e.proposalSentAt), "MMM d, yyyy h:mm a")
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {e.isValid ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordIntroDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        partners={partners}
        onCreated={handleCreated}
      />
    </div>
  );
}

function RecordIntroDialog({
  open,
  onOpenChange,
  partners,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partners: PartnerOption[];
  onCreated: (e: AttributionEventItem) => void;
}) {
  const [partnerId, setPartnerId] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [company, setCompany] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [recordedAt, setRecordedAt] = useState(nowLocalInput());
  const [proposalSentAt, setProposalSentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lateIntro =
    !!recordedAt &&
    !!proposalSentAt &&
    new Date(recordedAt).getTime() > new Date(proposalSentAt).getTime();

  function reset() {
    setPartnerId("");
    setProspectEmail("");
    setProspectName("");
    setCompany("");
    setSourceDetail("");
    setRecordedAt(nowLocalInput());
    setProposalSentAt("");
    setNotes("");
  }

  async function handleSubmit() {
    if (!partnerId) {
      toast.error("Select a partner");
      return;
    }
    if (!prospectEmail.trim()) {
      toast.error("Prospect email is required");
      return;
    }
    if (!recordedAt) {
      toast.error("Recorded date is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/partners/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          prospectEmail: prospectEmail.trim(),
          prospectName: prospectName.trim() || null,
          company: company.trim() || null,
          sourceDetail: sourceDetail.trim() || null,
          recordedAt: new Date(recordedAt).toISOString(),
          proposalSentAt: proposalSentAt
            ? new Date(proposalSentAt).toISOString()
            : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to record introduction");
        return;
      }

      const data = await res.json();
      const ev = data.event;
      const partner = partners.find((p) => p.id === partnerId);
      onCreated({
        id: ev.id,
        partnerId: ev.partnerId,
        partnerName: partner?.name ?? null,
        partnerIsSample: partner?.isSample ?? false,
        type: ev.type,
        prospectEmail: ev.prospectEmail,
        prospectName: ev.prospectName,
        company: ev.company,
        sourceDetail: ev.sourceDetail,
        recordedAt:
          typeof ev.recordedAt === "string"
            ? ev.recordedAt
            : new Date(ev.recordedAt).toISOString(),
        proposalSentAt: ev.proposalSentAt
          ? typeof ev.proposalSentAt === "string"
            ? ev.proposalSentAt
            : new Date(ev.proposalSentAt).toISOString()
          : null,
        isValid: ev.isValid,
        notes: ev.notes,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record direct introduction</DialogTitle>
          <DialogDescription>
            Log a partner-made introduction. To win attribution it must be
            recorded before the sales proposal goes out (Playbook §13).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Partner</Label>
            <PartnerCombobox
              partners={partners}
              value={partnerId}
              onChange={setPartnerId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prospectEmail">Prospect email</Label>
            <Input
              id="prospectEmail"
              type="email"
              required
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
              placeholder="prospect@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prospectName">Prospect name</Label>
              <Input
                id="prospectName"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceDetail">Source detail</Label>
            <Input
              id="sourceDetail"
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
              placeholder="e.g. warm intro over email"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="recordedAt">Recorded at</Label>
              <Input
                id="recordedAt"
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposalSentAt">Proposal sent at</Label>
              <Input
                id="proposalSentAt"
                type="datetime-local"
                value={proposalSentAt}
                onChange={(e) => setProposalSentAt(e.target.value)}
              />
            </div>
          </div>

          {lateIntro && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              This intro is logged after the proposal — it will be recorded but
              won&apos;t win attribution (Playbook §13).
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording…" : "Record introduction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// PAYOUTS — batch history + generate + mark paid
// =============================================================

function PayoutsSection({ initialBatches }: { initialBatches: BatchRow[] }) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
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
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to generate batch");
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="max-w-2xl text-sm text-zinc-500">
          Batches are auto-generated monthly. Preview the next run, generate a
          batch on demand, then export and release it. Releasing money is always
          a manual click. Net-45 terms.
        </p>
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
            Generate payout batch
          </Button>
        </div>
      </div>

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

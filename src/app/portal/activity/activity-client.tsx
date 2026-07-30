"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

export type StatusKey = "pending" | "earned" | "paid" | "reversed" | "rejected";

export interface ActivityRow {
  id: string;
  programName: string | null;
  buyerEmail: string;
  commissionCents: number;
  status: StatusKey;
  purchasedAt: string | null;
  createdAt: string;
  expectedPayoutAt: string | null;
  paidAt: string | null;
}

const STATUS_BADGE: Record<StatusKey, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  earned: "bg-indigo-50 text-[#4f46e5] ring-1 ring-indigo-200",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  reversed: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200",
  rejected: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200",
};

const STATUS_LABEL: Record<StatusKey, string> = {
  pending: "Pending",
  earned: "Earned",
  paid: "Paid",
  reversed: "Reversed",
  rejected: "Rejected",
};

const STATUS_ORDER: StatusKey[] = [
  "pending",
  "earned",
  "paid",
  "reversed",
  "rejected",
];

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain ?? ""}`;
}

/** Format a real instant in the viewer's local time. */
function fmt(iso: string | null): string {
  return iso ? format(new Date(iso), "MMM d, yyyy") : "—";
}

/**
 * Format a UTC CALENDAR date (e.g. the synthetic payout date, built at UTC
 * midnight) as that same calendar day for every viewer — reading the UTC Y/M/D
 * and reformatting locally avoids the one-day-earlier shift in the Americas.
 */
function fmtCalendar(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return format(
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    "MMM d, yyyy",
  );
}

export function ActivityClient({
  rows,
  payoutTermsDays,
  minPayoutCents,
  refundWindowDays,
}: {
  rows: ActivityRow[];
  payoutTermsDays: number;
  minPayoutCents: number;
  refundWindowDays: number;
}) {
  const columns: DataTableColumn<ActivityRow>[] = useMemo(() => [
    {
      key: "program",
      header: "Program",
      cell: (r) => (
        <span className="font-medium text-[#1e1b4b]">
          {r.programName ?? "—"}
        </span>
      ),
      sortAccessor: (r) => r.programName ?? "",
      filterValue: (r) => r.programName ?? "",
    },
    {
      key: "lead",
      header: "Lead",
      cell: (r) => <span className="text-slate-500">{maskEmail(r.buyerEmail)}</span>,
      sortAccessor: (r) => r.buyerEmail,
      filterValue: (r) => r.buyerEmail,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      ),
      sortAccessor: (r) => STATUS_ORDER.indexOf(r.status),
    },
    {
      key: "commission",
      header: "Commission",
      align: "right",
      cell: (r) => (
        <span
          className={
            r.status === "reversed"
              ? "text-zinc-400 line-through"
              : "font-medium text-[#1e1b4b]"
          }
        >
          {usd(r.commissionCents)}
        </span>
      ),
      sortAccessor: (r) => r.commissionCents,
    },
    {
      key: "purchased",
      header: "Purchased",
      align: "right",
      cell: (r) => (
        <span className="text-slate-500">{fmt(r.purchasedAt ?? r.createdAt)}</span>
      ),
      sortAccessor: (r) => Date.parse(r.purchasedAt ?? r.createdAt),
    },
    {
      key: "expectedPayout",
      header: "Expected payout",
      align: "right",
      headerTooltip: (
        <span>
          New commissions are held for a {refundWindowDays}-day refund grace
          period, then clear to Earned. On Net-{payoutTermsDays} terms they
          become payable {payoutTermsDays} days after the end of the month they
          were earned in, once your balance reaches the {usd(minPayoutCents)}{" "}
          minimum and your Stripe payout account + tax form are on file —
          otherwise the balance rolls to the next cycle.
        </span>
      ),
      cell: (r) => {
        if (r.status === "paid") {
          // paidAt is the batch finalization time; a conversion can flip to
          // paid before its batch is stamped, so guard the missing date.
          return (
            <span className="text-emerald-600">
              {r.paidAt ? `Paid ${fmt(r.paidAt)}` : "Paid"}
            </span>
          );
        }
        if (r.status === "reversed" || r.status === "rejected") {
          return <span className="text-slate-400">—</span>;
        }
        return <span className="text-slate-600">~ {fmtCalendar(r.expectedPayoutAt)}</span>;
      },
      sortAccessor: (r) => {
        const iso = r.status === "paid" ? r.paidAt : r.expectedPayoutAt;
        return iso ? Date.parse(iso) : null;
      },
    },
  ], [payoutTermsDays, minPayoutCents, refundWindowDays]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      filterPlaceholder="Search program or lead…"
      initialSort={{ key: "purchased", dir: "desc" }}
      groupBy={{
        keyOf: (r) => r.status,
        label: (k) => STATUS_LABEL[k as StatusKey] ?? k,
        order: STATUS_ORDER,
      }}
      groupToggleLabel="Group by status"
      emptyState={
        <span>
          No referrals yet — share your link to get started. When someone you
          referred makes a purchase, it will appear here with its commission and
          current status.
        </span>
      }
    />
  );
}

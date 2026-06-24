import { format } from "date-fns";
import { Activity } from "lucide-react";
import { requirePartner } from "@/lib/partners/session";
import { db } from "@/lib/db";
import { partnerConversions, partnerPrograms } from "@/lib/db/schema";
import { and, eq, desc, ne, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type StatusKey = "pending" | "earned" | "paid" | "reversed" | "rejected";

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

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function maskEmail(email: string): string {
  return `${email.split("@")[0].slice(0, 1)}•••@${email.split("@")[1] ?? ""}`;
}

export default async function ActivityPage() {
  const partner = await requirePartner();

  const rows = await db
    .select({
      id: partnerConversions.id,
      buyerEmail: partnerConversions.buyerEmail,
      commissionCents: partnerConversions.commissionCents,
      status: partnerConversions.status,
      source: partnerConversions.source,
      purchasedAt: partnerConversions.purchasedAt,
      createdAt: partnerConversions.createdAt,
      programName: partnerPrograms.name,
    })
    .from(partnerConversions)
    .leftJoin(
      partnerPrograms,
      eq(partnerConversions.programId, partnerPrograms.id),
    )
    .where(
      and(
        eq(partnerConversions.partnerId, partner.id),
        ne(partnerConversions.source, "clawback"),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${partnerConversions.purchasedAt}, ${partnerConversions.createdAt})`,
      ),
    );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#1e1b4b]">
          <Activity className="h-6 w-6 text-[#4f46e5]" />
          Referral activity
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Conversions attributed to your referrals.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-[#1e1b4b]">
            No referrals yet — share your link to get started
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            When someone you referred makes a purchase, it will appear here with
            its commission and current status.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Program</th>
                <th className="px-5 py-3">Buyer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Commission</th>
                <th className="px-5 py-3 text-right">Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const status = (row.status as StatusKey) ?? "pending";
                const strike =
                  status === "reversed" ? "text-zinc-400 line-through" : "";
                const dateVal = row.purchasedAt ?? row.createdAt;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-[#1e1b4b]">
                      {row.programName ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {maskEmail(row.buyerEmail)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? STATUS_BADGE.pending}`}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right tabular-nums font-medium text-[#1e1b4b] ${strike}`}
                    >
                      {usd(row.commissionCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500">
                      {dateVal ? format(dateVal, "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          What the statuses mean
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE.pending}`}
            >
              Pending
            </span>
            <span>In the refund window — not yet cleared to earn.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE.earned}`}
            >
              Earned
            </span>
            <span>Cleared and awaiting payout in an upcoming batch.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE.paid}`}
            >
              Paid
            </span>
            <span>Paid out to you.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

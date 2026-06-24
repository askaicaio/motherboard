// Partner portal — Payouts + tax form.
// Server component. Every query is scoped to the logged-in partner.
import { requirePartner } from "@/lib/partners/session";
import { db } from "@/lib/db";
import { partnerConversions, partnerPayoutBatches } from "@/lib/db/schema";
import { and, eq, sql, desc, isNotNull } from "drizzle-orm";
import { TaxFormClient } from "@/components/portal/tax-form-client";
import { ConnectPayoutCard } from "./connect-client";
import { ShieldCheck, AlertTriangle, Banknote, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// YYYYMM int → "Jun 2026"
function formatPeriod(yyyymm: number): string {
  const year = Math.floor(yyyymm / 100);
  const month = yyyymm % 100;
  const d = new Date(Date.UTC(year, Math.max(0, month - 1), 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const BATCH_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  exported: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const TAX_LABEL: Record<string, string> = {
  none: "Not submitted",
  w9: "W-9",
  w8ben: "W-8BEN",
  w8bene: "W-8BEN-E",
  invalid: "Invalid — please resubmit",
};

const METHOD_LABEL: Record<string, string> = {
  none: "Not set",
  ach: "ACH (bank transfer)",
  zelle: "Zelle",
};

const VALID_TAX = ["w9", "w8ben", "w8bene"];

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const partner = await requirePartner();
  const { connect } = await searchParams;
  const justReturned = connect === "done";

  // Batches this partner has been included in, with THIS partner's summed
  // commission per batch. Scoped to partner.id; only batched conversions.
  const batches = await db
    .select({
      batchId: partnerPayoutBatches.id,
      periodYyyymm: partnerPayoutBatches.periodYyyymm,
      status: partnerPayoutBatches.status,
      paidAt: partnerPayoutBatches.paidAt,
      generatedAt: partnerPayoutBatches.generatedAt,
      amountCents: sql<number>`coalesce(sum(${partnerConversions.commissionCents}), 0)`,
    })
    .from(partnerConversions)
    .innerJoin(
      partnerPayoutBatches,
      eq(partnerConversions.payoutBatchId, partnerPayoutBatches.id),
    )
    .where(
      and(
        eq(partnerConversions.partnerId, partner.id),
        isNotNull(partnerConversions.payoutBatchId),
      ),
    )
    .groupBy(
      partnerPayoutBatches.id,
      partnerPayoutBatches.periodYyyymm,
      partnerPayoutBatches.status,
      partnerPayoutBatches.paidAt,
      partnerPayoutBatches.generatedAt,
    )
    .orderBy(desc(partnerPayoutBatches.periodYyyymm));

  const taxValid = VALID_TAX.includes(partner.taxFormStatus);
  const totalPaidCents = batches
    .filter((b) => b.status === "paid")
    .reduce((s, b) => s + Number(b.amountCents), 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">Payouts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your payout history and the tax + banking details we use to pay you.
        </p>
      </header>

      {/* Tax / banking readiness banner */}
      {!taxValid && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Action needed before we can pay you</p>
            <p className="mt-0.5 text-amber-700">
              A valid W-9 or W-8BEN/W-8BEN-E is required before any payout is
              released. Complete your tax form below.
            </p>
          </div>
        </div>
      )}

      {/* Payout terms */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Banknote className="h-5 w-5 text-[#4f46e5]" />
          <p className="mt-2 text-sm font-semibold text-[#1e1b4b]">Net-45 terms</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Earned commissions are paid 45 days after the close of the period.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileText className="h-5 w-5 text-[#4f46e5]" />
          <p className="mt-2 text-sm font-semibold text-[#1e1b4b]">$100 minimum</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Balances under $100 roll forward to the next payout cycle.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="h-5 w-5 text-[#4f46e5]" />
          <p className="mt-2 text-sm font-semibold text-[#1e1b4b]">ACH or Zelle</p>
          <p className="mt-0.5 text-xs text-slate-500">
            A valid W-9 / W-8BEN is required before any payout is released.
          </p>
        </div>
      </section>

      {/* Payout history */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1e1b4b]">Payout history</h2>
          {totalPaidCents > 0 && (
            <span className="text-xs text-slate-500">
              Paid to date:{" "}
              <span className="font-semibold tabular-nums text-[#1e1b4b]">
                {usd(totalPaidCents)}
              </span>
            </span>
          )}
        </div>

        {batches.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-[#1e1b4b]">No payouts yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Once your earned balance reaches $100 and your tax form is on file,
              you&apos;ll appear in the next payout batch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Your amount</th>
                  <th className="px-5 py-3">Paid date</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.batchId}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-5 py-3.5 font-medium text-[#1e1b4b]">
                      {formatPeriod(b.periodYyyymm)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                          BATCH_BADGE[b.status] ?? BATCH_BADGE.draft
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#1e1b4b]">
                      {usd(Number(b.amountCents))}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {b.status === "paid" ? formatDate(b.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Automatic payouts via Stripe Connect */}
      <section className="mb-6">
        <ConnectPayoutCard
          initialStatus={partner.stripeConnectStatus ?? "none"}
          justReturned={justReturned}
        />
      </section>

      {/* Tax form + payout details — fallback for affiliates who don't connect */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1e1b4b]">
              Tax form &amp; payout details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Keep these current so we can release your earnings without delay.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${
                taxValid
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
              }`}
            >
              {taxValid ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Tax form: {TAX_LABEL[partner.taxFormStatus] ?? partner.taxFormStatus}
            </span>
            <span className="text-slate-500">
              Payout method:{" "}
              <span className="font-medium text-[#1e1b4b]">
                {METHOD_LABEL[partner.payoutMethod] ?? partner.payoutMethod}
              </span>
            </span>
          </div>
        </div>

        <TaxFormClient
          taxFormStatus={partner.taxFormStatus}
          payoutMethod={partner.payoutMethod}
          payoutDetails={partner.payoutDetails}
        />
      </section>
    </div>
  );
}

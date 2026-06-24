import { ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { requirePartner } from "@/lib/partners/session";
import { db } from "@/lib/db";
import { partnerDisputes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DisputeFormClient } from "@/components/portal/dispute-form-client";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  upheld: {
    label: "Upheld",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  denied: { label: "Denied", className: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  closed: { label: "Closed", className: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? {
      label: status,
      className: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export default async function DisputesPage() {
  const partner = await requirePartner();

  const disputes = await db
    .select()
    .from(partnerDisputes)
    .where(eq(partnerDisputes.partnerId, partner.id))
    .orderBy(desc(partnerDisputes.submittedAt));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1e1b4b]">
          Disputes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          File an attribution dispute when you believe a deal you sourced
          wasn&apos;t credited to you.
        </p>
      </header>

      {/* File a new dispute */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1e1b4b]">File a dispute</h2>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 text-sm text-indigo-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p>
            You have <strong>14 days from the deal close date</strong> to file a
            dispute. CAIO reviews the evidence you provide and CAIO&apos;s
            determination is final.
          </p>
        </div>
        <div className="mt-5">
          <DisputeFormClient />
        </div>
      </section>

      {/* Existing disputes */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#1e1b4b]">
          Your disputes
        </h2>

        {disputes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">
              You haven&apos;t filed any disputes yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#1e1b4b]">
                      Submitted{" "}
                      {d.submittedAt
                        ? format(new Date(d.submittedAt), "MMM d, yyyy")
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Deal close date:{" "}
                      {d.dealCloseDate
                        ? format(new Date(d.dealCloseDate), "MMM d, yyyy")
                        : "Not specified"}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                {d.evidence && (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Evidence
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">
                      {d.evidence}
                    </p>
                  </div>
                )}

                {d.resolution && (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Resolution
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{d.resolution}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function DisputeFormClient() {
  const router = useRouter();
  const [dealCloseDate, setDealCloseDate] = useState("");
  const [evidence, setEvidence] = useState("");
  const [conversionRef, setConversionRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const body: {
        dealCloseDate: string;
        evidence: string;
        conversionId?: string;
      } = {
        dealCloseDate: new Date(dealCloseDate).toISOString(),
        evidence: evidence.trim(),
      };
      const ref = conversionRef.trim();
      if (ref) body.conversionId = ref;

      const res = await fetch("/api/portal/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message =
          res.status === 422
            ? "The 14-day dispute window (from the deal close date) has passed."
            : "We couldn't submit your dispute. Please try again.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // keep default message
        }
        setError(message);
        return;
      }

      setSuccess(true);
      setDealCloseDate("");
      setEvidence("");
      setConversionRef("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="dealCloseDate"
          className="block text-sm font-medium text-[#1e1b4b]"
        >
          Deal close date
        </label>
        <input
          id="dealCloseDate"
          type="date"
          required
          value={dealCloseDate}
          onChange={(e) => setDealCloseDate(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#1e1b4b] shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Disputes must be filed within 14 days of the deal close date.
        </p>
      </div>

      <div>
        <label
          htmlFor="evidence"
          className="block text-sm font-medium text-[#1e1b4b]"
        >
          Evidence
        </label>
        <textarea
          id="evidence"
          required
          rows={5}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="email threads, calendar invites, written introductions…"
          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#1e1b4b] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div>
        <label
          htmlFor="conversionRef"
          className="block text-sm font-medium text-[#1e1b4b]"
        >
          Conversion reference{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="conversionRef"
          type="text"
          value={conversionRef}
          onChange={(e) => setConversionRef(e.target.value)}
          placeholder="Conversion ID, if you have one"
          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#1e1b4b] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your dispute has been submitted. We&apos;ll review it and post a
            determination below.
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Submitting…" : "Submit dispute"}
      </button>
    </form>
  );
}

"use client";

// Partner-facing form to set tax form type + payout method/details.
// Posts to /api/portal/tax-form (scoped to the logged-in partner server-side).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const TAX_OPTIONS: { value: "w9" | "w8ben" | "w8bene"; label: string; hint: string }[] = [
  { value: "w9", label: "W-9", hint: "US persons & US-based entities" },
  { value: "w8ben", label: "W-8BEN", hint: "Non-US individuals" },
  { value: "w8bene", label: "W-8BEN-E", hint: "Non-US entities" },
];

const METHOD_OPTIONS: { value: "ach" | "zelle"; label: string }[] = [
  { value: "ach", label: "ACH (bank transfer)" },
  { value: "zelle", label: "Zelle" },
];

export function TaxFormClient({
  taxFormStatus,
  payoutMethod,
  payoutDetails,
}: {
  taxFormStatus: string;
  payoutMethod: string;
  payoutDetails: string | null;
}) {
  const router = useRouter();

  const [tax, setTax] = useState<"w9" | "w8ben" | "w8bene">(
    taxFormStatus === "w9" || taxFormStatus === "w8ben" || taxFormStatus === "w8bene"
      ? taxFormStatus
      : "w9",
  );
  const [method, setMethod] = useState<"ach" | "zelle">(
    payoutMethod === "zelle" ? "zelle" : "ach",
  );
  const [details, setDetails] = useState(payoutDetails ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/portal/tax-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxFormStatus: tax,
          payoutMethod: method,
          payoutDetails: details.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResult({
          ok: false,
          message: data?.error || "Could not save your details. Please try again.",
        });
        return;
      }
      setResult({ ok: true, message: "Saved. Your payout details are up to date." });
      router.refresh();
    } catch {
      setResult({
        ok: false,
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#1e1b4b]">Tax form type</label>
        <p className="mt-0.5 text-xs text-slate-500">
          Required before any payout can be released.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TAX_OPTIONS.map((opt) => {
            const active = tax === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setTax(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#4f46e5] bg-indigo-50 ring-1 ring-[#4f46e5]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold text-[#1e1b4b]">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1e1b4b]">Payout method</label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {METHOD_OPTIONS.map((opt) => {
            const active = method === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setMethod(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? "border-[#4f46e5] bg-indigo-50 text-[#1e1b4b] ring-1 ring-[#4f46e5]"
                    : "border-slate-200 bg-white text-[#1e1b4b] hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="payout-details"
          className="block text-sm font-medium text-[#1e1b4b]"
        >
          Payout details
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          {method === "zelle"
            ? "The email or phone number associated with your Zelle account."
            : "Your bank name, routing number, and account number."}
        </p>
        <textarea
          id="payout-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={
            method === "zelle"
              ? "e.g. payouts@yourdomain.com"
              : "e.g. Bank: Acme Bank · Routing: 123456789 · Account: 000123456"
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#1e1b4b] placeholder:text-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
        />
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save payout details"}
        </button>
      </div>
    </form>
  );
}

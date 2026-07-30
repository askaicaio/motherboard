"use client";

// Affiliate self-service profile editor — contact address only. Name + email are
// admin-managed (shown read-only). Tax form and payout account have their own
// pages. Country/state use the same adaptive lists as the public apply form.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  COUNTRY_OPTIONS,
  regionsFor,
  regionLabel,
  postalLabel,
} from "@/lib/partners/geo";

export function ProfileClient({
  name,
  email,
  address,
  city,
  state,
  postalCode,
  country,
}: {
  name: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    address: address ?? "",
    city: city ?? "",
    state: state ?? "",
    postalCode: postalCode ?? "",
    country:
      country && (COUNTRY_OPTIONS as readonly string[]).includes(country)
        ? country
        : "United States",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const regions = regionsFor(form.country);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Country changed → clear a now-invalid state selection.
      if (key === "country" && !regionsFor(value).includes(f.state)) {
        next.state = "";
      }
      return next;
    });
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#1e1b4b] placeholder:text-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({
          ok: false,
          message: data?.error || "Could not save. Please try again.",
        });
        return;
      }
      setResult({ ok: true, message: "Saved. Your details are up to date." });
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
      {/* Read-only identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1e1b4b]">Name</label>
          <input
            value={name}
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1e1b4b]">Email</label>
          <input
            value={email}
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        Need to change your name or email? Message the CAIO team.
      </p>

      {/* Editable address */}
      <div>
        <label htmlFor="pf-address" className="block text-sm font-medium text-[#1e1b4b]">
          Address
        </label>
        <input
          id="pf-address"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street address"
          className={inputCls}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-country" className="block text-sm font-medium text-[#1e1b4b]">
            Country
          </label>
          <select
            id="pf-country"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            className={inputCls}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pf-city" className="block text-sm font-medium text-[#1e1b4b]">
            City
          </label>
          <input
            id="pf-city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-state" className="block text-sm font-medium text-[#1e1b4b]">
            {regionLabel(form.country)}
          </label>
          <select
            id="pf-state"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Select {regionLabel(form.country).toLowerCase()}…
            </option>
            {regions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pf-postal" className="block text-sm font-medium text-[#1e1b4b]">
            {postalLabel(form.country)}
          </label>
          <input
            id="pf-postal"
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {result && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

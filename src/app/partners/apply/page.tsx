"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function PartnerApplyPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || undefined,
          website: form.website.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Logo / wordmark area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Affiliate Program
          </h1>
          <p className="mt-2 text-slate-500 text-base">
            Earn up to{" "}
            <span className="font-semibold text-indigo-600">$5,400</span> per
            referral. Apply below to get started.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {success ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
              <CheckCircle2 className="w-14 h-14 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-900">
                Application received!
              </h2>
              <p className="text-slate-500 max-w-sm">
                Thank you for your interest in partnering with Chief AI Officer.
                We&apos;ll review your application and be in touch within a few
                business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Work email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="company"
                  className="block text-sm font-medium text-slate-700"
                >
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="website"
                  className="block text-sm font-medium text-slate-700"
                >
                  Website{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  autoComplete="url"
                  placeholder="https://yoursite.com"
                  value={form.website}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-slate-700"
                >
                  Why do you want to partner / tell us about your audience{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  required
                  rows={4}
                  placeholder="I work with senior executives and HR leaders at Fortune 500 companies who are actively exploring AI adoption…"
                  value={form.notes}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>

              <p className="text-center text-xs text-slate-400">
                We review every application personally and respond within 3
                business days.
              </p>
            </form>
          )}
        </div>

        {/* Credential bar */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
          <span>10% flat commission</span>
          <span className="w-px h-3 bg-slate-300" />
          <span>60-day cookie window</span>
          <span className="w-px h-3 bg-slate-300" />
          <span>Net-45 payouts</span>
        </div>
      </div>
    </div>
  );
}

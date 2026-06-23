"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function PortalForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/portal/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">
          Reset password
        </h1>
        {sent ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            If an account exists for that email, we&apos;ve sent a reset link.
            Check your inbox.
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Enter your email and we&apos;ll send you a link to set a new
              password.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/portal/login" className="text-[#4f46e5] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

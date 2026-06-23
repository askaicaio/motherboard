"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function SetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not set password");
        return;
      }
      router.push("/portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This link is missing its token.{" "}
        <Link href="/portal/forgot" className="font-medium underline">
          Request a new one
        </Link>
        .
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          New password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Confirm password
        </label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Set password & sign in
      </button>
    </form>
  );
}

export default function PortalSetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">
          Set your password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a password to access your affiliate portal.
        </p>
        <Suspense fallback={<div className="mt-6 text-sm text-slate-400">Loading…</div>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

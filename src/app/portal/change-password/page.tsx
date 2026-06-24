"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PortalChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not update your password.");
        return;
      }
      router.push("/portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">
          Choose your password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Set a password to replace your temporary one.
        </p>

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
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              minLength={8}
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
            Save password
          </button>
        </form>
      </div>
    </div>
  );
}

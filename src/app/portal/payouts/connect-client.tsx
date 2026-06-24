"use client";

// Affiliate-facing "Get paid automatically" card. Lets the affiliate connect a
// Stripe Express payout account so commissions are transferred automatically.
// POSTs /api/portal/connect to start onboarding, then redirects to Stripe.
// When the affiliate returns with ?connect=done it refreshes the status once.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";

type ConnectStatus = "none" | "onboarding" | "restricted" | "ready" | string;

export function ConnectPayoutCard({
  initialStatus,
  justReturned,
}: {
  initialStatus: ConnectStatus;
  justReturned: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(justReturned);
  const [error, setError] = useState<string | null>(null);

  // After returning from Stripe onboarding, refresh the status exactly once.
  useEffect(() => {
    if (!justReturned) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/connect/status");
        const data = await res.json();
        if (!cancelled && typeof data?.status === "string") {
          setStatus(data.status);
          if (data.status === "ready") router.refresh();
        }
      } catch {
        // best-effort; keep the last-known status
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [justReturned, router]);

  async function startConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setError(
          data?.error ||
            "Couldn't start payout setup. Please try again or use the form below.",
        );
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  const isReady = status === "ready";
  const inProgress = status === "onboarding" || status === "restricted";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isReady ? "bg-emerald-50" : "bg-indigo-50"
          }`}
        >
          {isReady ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Zap className="h-5 w-5 text-[#4f46e5]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#1e1b4b]">
            Get paid automatically
          </h2>

          {isReady ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected — your payouts are sent automatically
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {inProgress
                  ? "Finish setting up your payout account so commissions are transferred to your bank automatically."
                  : "Connect a payout account and your earned commissions are transferred to you automatically — no waiting on a manual run."}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    inProgress
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {inProgress ? "Finishing setup" : "Not connected"}
                </span>
                {refreshing && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking…
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={startConnect}
                disabled={loading}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {inProgress ? "Finish payout setup" : "Connect payout account"}
              </button>

              {error && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

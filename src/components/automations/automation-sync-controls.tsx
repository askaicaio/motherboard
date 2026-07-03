"use client";

// The "Auto-refresh list" toggle + "Refresh List" button, as a standalone
// control group so pages beyond the Per Website Page can host them (currently
// also the Per Website Error History page).
//
// SAME FUNCTION as the Per Website Page's copy — they drive the SAME per-platform,
// app-wide state:
//   - "Refresh List"  → POST /api/automations/sync   (runs that platform's real sync)
//   - Auto-refresh    → POST/GET /api/automations/autorefresh (Option A, shared setting)
// so toggling here is the exact same switch as on the Per Website Page, and a
// refresh here runs the exact same sync.
//
// NOTE ON DUPLICATION: the Per Website Page (AutomationsTableClient) keeps its
// OWN inline copy of these two controls because it additionally rewrites its
// visible table rows on each sync (setRows) and polls for fresh rows after a
// scheduled refresh. This component deliberately OMITS that row handling — the
// Error History page has no automation list to refresh in place — which is why
// it wasn't unified into the table client (that would mean threading row state
// through and touching the verified-working page). Candidate to consolidate
// later. Keep the auto-refresh/refresh behaviour here in step with the table
// client's copy.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** 24 hours in ms — the auto-refresh cadence (client-side copy; the server is
 *  the source of truth, this is only for the instant optimistic countdown). */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Format milliseconds remaining as HH:MM:SS (clamped at 0). */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function AutomationSyncControls({
  platform,
  canSync = false,
  hasApiKey = false,
  autoRefresh = { enabled: false, nextRefreshAt: null },
}: {
  platform: string;
  /** When true, "Refresh List" performs a real sync; otherwise it shows the
   *  temporary placeholder error (platforms whose sync isn't built yet). */
  canSync?: boolean;
  /** Whether this platform has an API credential configured. Gates the
   *  auto-refresh toggle (can't turn on without an integration). */
  hasApiKey?: boolean;
  /** Server-provided auto-refresh state for this platform. */
  autoRefresh?: { enabled: boolean; nextRefreshAt: string | null };
}) {
  // "Refresh List" state. On syncable platforms the button calls the real sync;
  // on the rest it shows a temporary placeholder error. `refreshError` holds the
  // red error text; `refreshing` is the in-flight spinner state.
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-refresh mode state (Option A). `autoEnabled` + `nextRefreshAt` come
  // from the server; `remainingMs` is the live countdown; `autoError` is the
  // red text under the toggle (e.g. no API integration), fading after 5s.
  const [autoEnabled, setAutoEnabled] = useState(autoRefresh.enabled);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(
    autoRefresh.nextRefreshAt,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    autoRefresh.enabled && autoRefresh.nextRefreshAt
      ? new Date(autoRefresh.nextRefreshAt).getTime() - Date.now()
      : 0,
  );
  const [autoError, setAutoError] = useState<string | null>(null);
  const autoErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest `handleRefresh`, so the countdown-elapsed effect can trigger a
  // (silent) sync without depending on its identity.
  const handleRefreshRef = useRef<
    ((opts?: { silent?: boolean }) => void) | null
  >(null);
  // Latest nextRefreshAt, read by the countdown-elapsed effect to re-verify the
  // countdown REALLY reached zero before firing (guards against a stale
  // remainingMs during rapid toggling).
  const nextRefreshAtRef = useRef(nextRefreshAt);
  // Monotonic id per toggle click, so an out-of-order / stale server response
  // can't clobber the state set by a newer toggle.
  const autoReqSeq = useRef(0);

  // Clear any pending timers if the component unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (autoErrorTimer.current) clearTimeout(autoErrorTimer.current);
    };
  }, []);

  // Live countdown to the next scheduled refresh (ticks every second).
  useEffect(() => {
    if (!autoEnabled || !nextRefreshAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () =>
      setRemainingMs(new Date(nextRefreshAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoEnabled, nextRefreshAt]);

  // Keep the latest nextRefreshAt in a ref for the elapsed effect's re-verify
  // guard. Declared BEFORE that effect so it updates first in the same commit.
  useEffect(() => {
    nextRefreshAtRef.current = nextRefreshAt;
  }, [nextRefreshAt]);

  // Once the countdown elapses, the cron refreshes server-side within its
  // interval. Fire a visible silent sync + poll the schedule so an open tab
  // stays in step. (Unlike the table client, there are no rows to re-pull here.)
  const countdownElapsed = autoEnabled && !!nextRefreshAt && remainingMs <= 0;
  useEffect(() => {
    if (!countdownElapsed) return;
    // Re-verify against the ACTUAL target before firing — rapid on/off toggling
    // can leave countdownElapsed briefly true off a stale remainingMs.
    const target = nextRefreshAtRef.current;
    if (target && new Date(target).getTime() - Date.now() > 0) return;
    handleRefreshRef.current?.({ silent: true });
    const id = setInterval(async () => {
      try {
        const stateRes = await fetch(
          `/api/automations/autorefresh?platform=${platform}`,
        );
        if (stateRes.ok) {
          const { state } = await stateRes.json();
          setAutoEnabled(!!state?.enabled);
          if (state?.nextRefreshAt) setNextRefreshAt(state.nextRefreshAt);
        }
      } catch {
        // transient; retry on the next tick
      }
    }, 30000);
    return () => clearInterval(id);
  }, [countdownElapsed, platform]);

  // Show a red error under the button for 5s, then auto-revert. Used for both
  // the placeholder (non-syncable platforms) and real sync failures.
  const showRefreshError = (message: string) => {
    setRefreshError(message);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshError(null), 5000);
  };

  // `silent` (used by the scheduled auto-refresh) does the same sync + spinner
  // but suppresses the success toast and the error text.
  const handleRefresh = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    // Platforms without a real sync keep the temporary placeholder error.
    if (!canSync) {
      if (!silent)
        showRefreshError("Couldn't refresh. Live syncing isn't set up yet.");
      return;
    }

    if (refreshing) return; // ignore double-clicks while a sync is in flight
    setRefreshError(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setRefreshing(true);
    try {
      const res = await fetch("/api/automations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Refresh failed.");

      if (!silent) {
        const r = data.result;
        const summary =
          r && (r.created || r.updated)
            ? `Synced. ${r.created} added, ${r.updated} updated.`
            : "List is up to date.";
        toast.success(summary);
      }
    } catch (err) {
      if (!silent) {
        const message = err instanceof Error ? err.message : "Refresh failed.";
        showRefreshError(message);
      }
    } finally {
      setRefreshing(false);
      if (silent) {
        // Re-anchor the countdown so it loops immediately instead of sticking
        // on "Refreshing soon…" until the cron + poll reset it.
        setNextRefreshAt(new Date(Date.now() + DAY_MS).toISOString());
      }
    }
  };
  // Keep the ref pointing at the latest handleRefresh for the elapsed effect.
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  // Red error under the auto-refresh toggle, fading after 5s (the standing
  // default for transient error texts).
  const showAutoError = (message: string) => {
    setAutoError(message);
    if (autoErrorTimer.current) clearTimeout(autoErrorTimer.current);
    autoErrorTimer.current = setTimeout(() => setAutoError(null), 5000);
  };

  const handleAutoToggle = async (checked: boolean) => {
    // Turning ON requires an API integration; block instantly if there's no key.
    if (checked && !hasApiKey) {
      showAutoError(
        "Can't auto-refresh. This website has no API integration yet.",
      );
      return; // leave the switch off (it's controlled by autoEnabled)
    }

    // Optimistic: flip the switch + countdown immediately; reconcile with the
    // server on success, or roll back + show a red error on failure.
    const prevEnabled = autoEnabled;
    const prevNext = nextRefreshAt;
    const seq = ++autoReqSeq.current;
    setAutoError(null);
    setAutoEnabled(checked);
    setNextRefreshAt(
      checked ? new Date(Date.now() + DAY_MS).toISOString() : null,
    );
    // Seed the countdown to the full interval in the SAME update so
    // countdownElapsed isn't briefly true from a stale remainingMs.
    setRemainingMs(checked ? DAY_MS : 0);

    try {
      const res = await fetch("/api/automations/autorefresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error || "Couldn't update auto-refresh.");
      // Ignore this response if a newer toggle has since fired (rapid on/off).
      if (seq !== autoReqSeq.current) return;
      // Reconcile with the server's canonical state (exact nextRefreshAt).
      setAutoEnabled(!!data.state?.enabled);
      setNextRefreshAt(data.state?.nextRefreshAt ?? null);
    } catch (err) {
      // A newer toggle superseded this one; leave the latest state as-is.
      if (seq !== autoReqSeq.current) return;
      // Roll back the optimistic change and surface the error.
      setAutoEnabled(prevEnabled);
      setNextRefreshAt(prevNext);
      showAutoError(
        err instanceof Error ? err.message : "Couldn't update auto-refresh.",
      );
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Auto-refresh mode (Option A). Styled like the Edit mode toggle but with
          a clock icon; ON = green, OFF = red. When ON, a countdown to the next
          scheduled refresh shows under it; turning it on without an API
          integration is blocked with a red error. Same behaviour + endpoint as
          the Per Website Page. */}
      <div className="relative flex items-center gap-2 text-xs text-zinc-600">
        <Clock className="h-3.5 w-3.5" />
        Auto-refresh list
        <Switch
          checked={autoEnabled}
          onCheckedChange={handleAutoToggle}
          className="data-checked:bg-green-600 data-unchecked:bg-red-600"
        />
        {autoError ? (
          <p
            role="alert"
            className="absolute left-0 top-full z-10 mt-1 max-w-xs text-xs font-medium text-red-600"
          >
            {autoError}
          </p>
        ) : autoEnabled && nextRefreshAt ? (
          <p className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-500">
            {remainingMs > 0
              ? `Next refresh in ${formatCountdown(remainingMs)}`
              : "Refreshing soon…"}
          </p>
        ) : null}
      </div>

      {/* Refresh List. Same style + behaviour as the Per Website Page: on
          syncable platforms it runs a real sync (spinner + success toast); on
          the rest it shows the temporary placeholder error. A failure turns the
          button red with the error message below it for 5s. */}
      <div className="relative">
        <Button
          size="sm"
          onClick={() => handleRefresh()}
          disabled={refreshing}
          className={cn(
            refreshError &&
              "bg-red-600 text-white hover:bg-red-600 focus-visible:ring-red-600/50",
          )}
        >
          <RefreshCw
            className={cn("mr-2 h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing…" : "Refresh List"}
        </Button>
        {refreshError && (
          <p
            role="alert"
            className="absolute right-0 top-full z-10 mt-1 max-w-xs text-right text-xs font-medium text-red-600"
          >
            {refreshError}
          </p>
        )}
      </div>
    </div>
  );
}

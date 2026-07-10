"use client";

// Standalone "Auto-refresh list" toggle (Option A), a self-contained copy of the
// toggle in the Per Website Page header (automations-table-client.tsx). Used on
// the Error History page so error capture, which is COUPLED to this toggle (see
// the checker cron + PR #152), can be controlled from the page that shows errors.
//
// Shared state: it reads/writes the SAME per-platform auto-refresh app-setting
// via /api/automations/autorefresh, so flipping it here is identical to flipping
// it on the Per Website Page (they mirror each other through the server).
//
// On countdown elapse it polls the server auto-refresh state to RE-ANCHOR the
// countdown (so it loops instead of sticking on "Refreshing soon…") and pings
// `onElapsePoll` so the parent can re-fetch fresh data (the Error History rows)
// WITHOUT a full page reload — the same "stay in sync" behaviour the Per Website
// table has (PRs #108/#110). The heavy error sweep still runs server-side on the
// cron; this only keeps the OPEN tab current.

import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";

// ⚠️ DEV TEST (2026-07-10, REVERT ME): temporarily 1 minute so the countdown
// matches the shortened server interval during the auto-refresh live test.
// Restore to `24 * 60 * 60 * 1000` after testing.
const DAY_MS = 60 * 1000;

/** Format milliseconds remaining as HH:MM:SS (clamped at 0). */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function AutoRefreshToggle({
  platform,
  hasApiKey,
  autoRefresh = { enabled: false, nextRefreshAt: null },
  onPoll,
}: {
  platform: string;
  /** Whether this platform has an API integration; turning ON is blocked without one. */
  hasApiKey: boolean;
  autoRefresh?: { enabled: boolean; nextRefreshAt: string | null };
  /** Called on each poll tick (every 30s) WHILE auto-refresh is enabled, so the
   *  parent can re-fetch its data (e.g. the Error History rows) and stay current
   *  without a page reload. Steady poll because the server error sweep lands a
   *  few minutes after the schedule fires, at a time that varies. */
  onPoll?: () => void;
}) {
  // `autoEnabled` + `nextRefreshAt` come from the server; `remainingMs` is the
  // live countdown; `autoError` is the red text under the toggle, fading after 5s.
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
  // Monotonic id per toggle click, so an out-of-order / stale server response
  // can't clobber the state set by a newer toggle (rapid on/off).
  const autoReqSeq = useRef(0);
  // Latest onPoll so the poll interval always calls the current callback without
  // re-subscribing when the parent re-renders.
  const onPollRef = useRef(onPoll);
  useEffect(() => {
    onPollRef.current = onPoll;
  });

  // Clear the fade timer on unmount.
  useEffect(() => {
    return () => {
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

  // While auto-refresh is ON, keep the OPEN tab in sync without a reload: every
  // 30s re-read the schedule (so the countdown LOOPS once the cron bumps it,
  // clearing "Refreshing soon…") and ping the parent to re-fetch its rows (the
  // Error History rows). A STEADY poll, not a one-shot on elapse: the server
  // error sweep writes new rows a few minutes after the schedule fires, at a
  // time that varies, so a fixed window would miss them. Only `nextRefreshAt` is
  // taken from the server here; `autoEnabled` stays user/toggle-driven so a poll
  // can't fight an optimistic on/off. Cleared on toggle-off / unmount.
  useEffect(() => {
    if (!autoEnabled) return;
    const poll = async () => {
      onPollRef.current?.(); // parent re-fetches its rows
      try {
        const res = await fetch(
          `/api/automations/autorefresh?platform=${platform}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const { state } = await res.json();
          if (state?.nextRefreshAt) setNextRefreshAt(state.nextRefreshAt);
        }
      } catch {
        // transient; retry on the next tick
      }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [autoEnabled, platform]);

  // Red error under the toggle, fading after 5s (the standing default for
  // transient error texts).
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

    // Optimistic: flip the switch + countdown IMMEDIATELY. The server call runs
    // in the background; reconcile on success, roll back + red error on failure.
    const prevEnabled = autoEnabled;
    const prevNext = nextRefreshAt;
    const seq = ++autoReqSeq.current;
    setAutoError(null);
    setAutoEnabled(checked);
    setNextRefreshAt(
      checked ? new Date(Date.now() + DAY_MS).toISOString() : null,
    );
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
      // Ignore a stale response if a newer toggle has since fired.
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
    // Matches the Per Website Page header toggle exactly: clock + label + a
    // green(ON)/red(OFF) Switch, with a countdown or red error beneath it.
    <div className="relative flex items-center gap-2 text-xs text-zinc-600">
      <Clock className="h-3.5 w-3.5" />
      Auto-refresh
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
  );
}

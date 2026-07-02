"use client";

// Main Page "API Health Check" button (Step 1 of the API Health Check feature).
//
// The button fans out the EXISTING per-card live check (POST /api/automations/
// check-key) to all 5 website cards at once: click it and every card runs its
// own "Checking API Key Status…" -> green/red, exactly as if each were clicked.
//
// Coordination is via a tiny client context: each CopyApiKeyButton registers
// its check() with the provider on mount; the button calls them all and waits
// for them to finish (so it can show its own "Checking…" state). This is
// EPHEMERAL — nothing is stored (the toggle/timer version in Step 2 adds
// server-side stored results). If a card is rendered without the provider it
// still works standalone (registration is a no-op).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Activity, Clock, Loader2 } from "lucide-react";

/** A single card's check; resolves with its result so the fan-out can persist
 *  them (or void if the card skipped, e.g. already checking). */
type CheckResult = { platform: string; ok: boolean };
type CheckFn = () => Promise<CheckResult | void>;

interface HealthCheckContextValue {
  /** Register a card's check; returns an unregister cleanup. */
  register: (fn: CheckFn) => () => void;
  /** Fire every registered card check at once. */
  runAll: () => void;
  /** True while a fan-out check is in flight. */
  running: boolean;
}

const HealthCheckContext = createContext<HealthCheckContextValue | null>(null);

export function HealthCheckProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // A ref-based registry so registering/unregistering cards never re-renders
  // the provider (only `running` does).
  const registry = useRef<Set<CheckFn>>(new Set());
  const [running, setRunning] = useState(false);

  const register = useCallback((fn: CheckFn) => {
    registry.current.add(fn);
    return () => {
      registry.current.delete(fn);
    };
  }, []);

  const runAll = useCallback(() => {
    if (running || registry.current.size === 0) return;
    setRunning(true);
    // Each card's check resolves with its result; wait for all (so "Checking…"
    // clears only once every card has settled), then PERSIST the batch in ONE
    // write so the status survives a page reload. Without this, a manual check is
    // ephemeral and the cards re-seed from the presence check on reload. One
    // batched write (not per-card) avoids a read-modify-write race on the shared
    // health state.
    void Promise.all([...registry.current].map((fn) => fn()))
      .then((settled) => {
        const results = settled.filter((r): r is CheckResult => !!r);
        if (results.length === 0) return;
        return fetch("/api/automations/health-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results }),
        }).catch(() => {
          // best-effort persistence; the on-screen result is still updated
        });
      })
      .finally(() => setRunning(false));
  }, [running]);

  return (
    <HealthCheckContext.Provider value={{ register, runAll, running }}>
      {children}
    </HealthCheckContext.Provider>
  );
}

/** Cards call this to join the global "check all" fan-out. Safe to call even
 *  when there is no provider (then it does nothing). Always registers the
 *  LATEST check via a ref, so it doesn't churn the registry on every render. */
export function useHealthCheckRegistration(check: CheckFn) {
  const ctx = useContext(HealthCheckContext);
  const checkRef = useRef(check);
  // Keep the ref pointing at the latest check (updated in an effect, not during
  // render) so the registered wrapper always calls the current closure.
  useEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    if (!ctx) return;
    return ctx.register(() => checkRef.current());
  }, [ctx]);
}

/** The Main Page toolbar button. Renders nothing if not inside a provider. */
export function ApiHealthCheckButton() {
  const ctx = useContext(HealthCheckContext);
  if (!ctx) return null;
  return (
    <Button size="sm" onClick={ctx.runAll} disabled={ctx.running}>
      {ctx.running ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Activity className="mr-2 h-3.5 w-3.5" />
      )}
      {ctx.running ? "Checking…" : "API Health Check"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Step 2: the "Auto-API health check" toggle (24h Option-A timer). Mirrors the
// per-website auto-refresh toggle: turning ON anchors a 24h countdown (no
// immediate check — the manual button covers "now"); the background cron runs
// the all-platform verify when it elapses, stores the results, and re-anchors.
// GREEN when ON, matching the auto-refresh toggle. NOT gated (it checks every
// platform, including ones with no key).
// ---------------------------------------------------------------------------

/** 24h in ms — client mirror of the server cadence (server is source of truth). */
const HEALTH_DAY_MS = 24 * 60 * 60 * 1000;

/** Format ms remaining as HH:MM:SS (clamped at 0). */
function formatHealthCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function AutoHealthCheckToggle({
  initialEnabled,
  initialNextCheckAt,
}: {
  initialEnabled: boolean;
  initialNextCheckAt: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [nextCheckAt, setNextCheckAt] = useState<string | null>(
    initialNextCheckAt,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    initialEnabled && initialNextCheckAt
      ? new Date(initialNextCheckAt).getTime() - Date.now()
      : 0,
  );
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  // Live countdown to the next scheduled check (ticks every second).
  useEffect(() => {
    if (!enabled || !nextCheckAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () =>
      setRemainingMs(new Date(nextCheckAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, nextCheckAt]);

  // Access the shared fan-out so the SCHEDULED check is visible: when the timer
  // fires, run the same all-cards check the manual button does (kept in a ref so
  // the elapse effect below doesn't churn when the provider value changes).
  const health = useContext(HealthCheckContext);
  const runAllRef = useRef(health?.runAll);
  useEffect(() => {
    runAllRef.current = health?.runAll;
  }, [health]);

  // When the countdown elapses: (1) fire the visible fan-out once (every card
  // shows "Checking API Key Status…" -> green/red, matching the manual button),
  // then (2) re-anchor the countdown so it loops IMMEDIATELY instead of sticking
  // on "Checking soon…" until the cron + poll reset it. Same interval the server
  // cron uses, so the two stay aligned. The poll below is a backstop reconcile.
  const elapsed = enabled && !!nextCheckAt && remainingMs <= 0;
  useEffect(() => {
    if (!elapsed) return;
    runAllRef.current?.();
    setNextCheckAt(new Date(Date.now() + HEALTH_DAY_MS).toISOString());
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/automations/health-autocheck");
        if (!res.ok) return;
        const { state } = await res.json();
        setEnabled(!!state?.enabled);
        setNextCheckAt(state?.nextCheckAt ?? null);
      } catch {
        // transient; retry on the next tick
      }
    }, 5000);
    return () => clearInterval(id);
  }, [elapsed]);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  };

  async function toggle(checked: boolean) {
    // Optimistic: flip + anchor the countdown immediately, reconcile after.
    const prevEnabled = enabled;
    const prevNext = nextCheckAt;
    setError(null);
    setEnabled(checked);
    setNextCheckAt(
      checked ? new Date(Date.now() + HEALTH_DAY_MS).toISOString() : null,
    );
    // Seed the countdown to the full interval in the SAME update so `elapsed`
    // isn't briefly true from a stale remainingMs (0 from when the toggle was
    // off) — otherwise a check would fire the instant the toggle turns on. It
    // must WAIT for the countdown to elapse.
    setRemainingMs(checked ? HEALTH_DAY_MS : 0);
    try {
      const res = await fetch("/api/automations/health-autocheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update.");
      setEnabled(!!data.state?.enabled);
      setNextCheckAt(data.state?.nextCheckAt ?? null);
    } catch (err) {
      setEnabled(prevEnabled);
      setNextCheckAt(prevNext);
      showError(err instanceof Error ? err.message : "Couldn't update.");
    }
  }

  return (
    <div className="relative flex items-center gap-2 text-xs text-zinc-600">
      <Clock className="h-3.5 w-3.5" />
      Auto-API health check
      <Switch
        checked={enabled}
        onCheckedChange={toggle}
        className="data-checked:bg-green-600"
      />
      {error ? (
        <p
          role="alert"
          className="absolute left-0 top-full z-10 mt-1 max-w-xs text-xs font-medium text-red-600"
        >
          {error}
        </p>
      ) : enabled && nextCheckAt ? (
        <p className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-500">
          {remainingMs > 0
            ? `Next check in ${formatHealthCountdown(remainingMs)}`
            : "Checking soon…"}
        </p>
      ) : null}
    </div>
  );
}


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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** The Main Page toolbar button. Renders nothing if not inside a provider.
 *
 *  ⚠️ `className` IS FOR ONE CALLER AND IS OTHERWISE UNUSED, added 2026-09-12.
 *  `/automations-alpha-a1` is a DARK page and this button's default variant is
 *  `bg-primary text-primary-foreground`, i.e. near-white text, which broke that
 *  page's rule that text is only ever amber, blue or red.
 *  **OMIT IT AND NOTHING CHANGES**, which is the point: the live hub and Beta2
 *  pass nothing and render exactly as before. It merges through `cn`, so an
 *  arbitrary `text-[...]` displaces the variant's colour rather than fighting it.
 *  📌 THE ALTERNATIVE WAS A LOCAL COPY of this 354-line file, as was done for
 *  `copy-api-key-button.tsx`. **Rejected here because this component is
 *  stateful** (countdown, persistence, error handling), so a twin would drift in
 *  BEHAVIOUR and not just in colour. The user made that call on 2026-09-12. */
export function ApiHealthCheckButton({ className }: { className?: string }) {
  const ctx = useContext(HealthCheckContext);
  if (!ctx) return null;
  return (
    <Button
      size="sm"
      onClick={ctx.runAll}
      disabled={ctx.running}
      className={className}
    >
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
  classNames,
}: {
  initialEnabled: boolean;
  initialNextCheckAt: string | null;
  /** Optional per-page colour overrides, added 2026-09-12 for the dark
   *  `/automations-alpha-a1`. **Omit it and every class below is exactly what it
   *  has always been**; the live hub and Beta2 pass nothing. Each one merges
   *  through `cn`, so an arbitrary `text-[...]` displaces the default colour.
   *  See `ApiHealthCheckButton` above for why this is a prop and not a copy. */
  classNames?: {
    /** The row wrapper, which is what colours the "Auto-API health check"
     *  label AND the clock icon beside it (the icon has no colour of its own). */
    label?: string;
    /** The "Next check in HH:MM:SS" line under the toggle. */
    countdown?: string;
    /** The transient failure line, which replaces the countdown. */
    error?: string;
  };
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
  // ⚠️⚠️ THIS EXISTS ONLY TO FIX A HYDRATION MISMATCH, 2026-09-11. Do not
  // remove it as dead-looking state.
  // THE BUG: `remainingMs` is seeded by a lazy `useState` initialiser that
  // calls `Date.now()`. That initialiser runs ONCE ON THE SERVER during SSR and
  // AGAIN ON THE CLIENT during hydration, and the two clocks are never the same
  // instant, so the server shipped "Next check in 21:36:05" and the browser
  // rendered "Next check in 21:35:49". React logged
  // "Hydration failed because the server rendered text didn't match".
  // THE FIX: do not render the countdown until the client has mounted. The
  // server and the first client render now agree on rendering NOTHING, which is
  // what hydration compares, and the real value appears a tick later from the
  // interval effect below.
  // ⚠️ WHY NOT SEED IT TO 0 INSTEAD: `remainingMs <= 0` is what `elapsed` reads
  // to fire the scheduled fan-out. A 0 at first render would make `elapsed`
  // true on every page load. **It would be caught** by that effect's re-verify
  // against `nextCheckAtRef`, which exists for exactly this, but relying on a
  // downstream guard to undo a wrong value is worse than not creating it.
  // ⚠️ WHY NOT `suppressHydrationWarning`: it silences the warning for the
  // whole subtree, including future real mismatches, and still ships a stale
  // number in the HTML. A countdown computed on the server is wrong by the time
  // it arrives, so the honest thing is not to send one.
  // 📌 NO LAYOUT SHIFT: this <p> is `absolute`, so appearing a tick later moves
  // nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest nextCheckAt, read by the elapsed effect to re-verify the countdown
  // REALLY reached zero before firing (guards against a stale remainingMs during
  // rapid toggling — see that effect).
  const nextCheckAtRef = useRef(nextCheckAt);
  // Monotonic id per toggle click, so an out-of-order / stale server response
  // can't clobber the state set by a newer toggle.
  const healthReqSeq = useRef(0);

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

  // Keep the latest nextCheckAt in a ref for the elapsed effect's re-verify
  // guard. Declared BEFORE that effect so it updates first in the same commit.
  useEffect(() => {
    nextCheckAtRef.current = nextCheckAt;
  }, [nextCheckAt]);

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
    // Re-verify against the ACTUAL target time before firing. Rapid on/off
    // toggling can leave `elapsed` briefly true off a STALE remainingMs (a 0
    // left from a prior OFF) even though nextCheckAt is ~24h out; only fire once
    // the countdown has genuinely reached zero.
    const target = nextCheckAtRef.current;
    if (target && new Date(target).getTime() - Date.now() > 0) return;
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
    const seq = ++healthReqSeq.current;
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
      // Ignore this response if a newer toggle has since fired (rapid on/off):
      // its optimistic state is the truth, and applying a stale response here
      // could re-enable + re-anchor after the user settled on OFF.
      if (seq !== healthReqSeq.current) return;
      setEnabled(!!data.state?.enabled);
      setNextCheckAt(data.state?.nextCheckAt ?? null);
    } catch (err) {
      // A newer toggle superseded this one; leave the latest state as-is.
      if (seq !== healthReqSeq.current) return;
      setEnabled(prevEnabled);
      setNextCheckAt(prevNext);
      showError(err instanceof Error ? err.message : "Couldn't update.");
    }
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 text-xs text-zinc-600",
        classNames?.label,
      )}
    >
      {/* Tooltip on the LABEL, not the Switch: the switch is the control and
          wrapping it in a trigger risks the one interaction that matters. The
          two non-obvious facts are that the cadence is 24h and that turning it
          ON does not check immediately. */}
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <span className="inline-flex cursor-help items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Auto-API health check
            </span>
          }
        />
        <TooltipContent className="max-w-xs">
          Checks every website&rsquo;s API key once every 24 hours and stores the
          result on its card.
        </TooltipContent>
      </Tooltip>
      <Switch
        checked={enabled}
        onCheckedChange={toggle}
        className="data-checked:bg-green-600 data-unchecked:bg-red-600"
      />
      {error ? (
        <p
          role="alert"
          className={cn(
            "absolute left-0 top-full z-10 mt-1 max-w-xs text-xs font-medium text-red-600",
            classNames?.error,
          )}
        >
          {error}
        </p>
      ) : mounted && enabled && nextCheckAt ? (
        <p
          className={cn(
            "absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-500",
            classNames?.countdown,
          )}
        >
          {remainingMs > 0
            ? `Next check in ${formatHealthCountdown(remainingMs)}`
            : "Checking soon…"}
        </p>
      ) : null}
    </div>
  );
}


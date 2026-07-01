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
import { Activity, Loader2 } from "lucide-react";

/** A single card's check, wrapped to resolve when its verify finishes. */
type CheckFn = () => Promise<void>;

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
    // Each card's check resolves independently; wait for all so the button's
    // "Checking…" clears only once every card has settled.
    void Promise.all([...registry.current].map((fn) => fn())).finally(() =>
      setRunning(false),
    );
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

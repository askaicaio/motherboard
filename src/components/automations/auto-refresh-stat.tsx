"use client";

// Main Page card stat: "Auto-refresh list:" + this platform's auto-refresh
// state. Sits at the top of the card's stats (above Total / Active / Paused).
// The on/off state + nextRefreshAt come from the server (the stored
// `automations_autorefresh` app-setting, the source of truth); this component
// only runs the UI-only ticking countdown, mirroring the per-website page.
//
//   ON  -> green check + "Next refresh in HH:MM:SS" (live countdown)
//   OFF -> red X (no countdown text)

import { useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

/** Format milliseconds remaining as HH:MM:SS (clamped at 0). Matches the
 *  per-website page's countdown formatting. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function AutoRefreshStat({
  enabled,
  nextRefreshAt,
}: {
  enabled: boolean;
  /** ISO timestamp of the next scheduled refresh, or null when off. */
  nextRefreshAt: string | null;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    enabled && nextRefreshAt
      ? new Date(nextRefreshAt).getTime() - Date.now()
      : 0,
  );

  // Live countdown (ticks every second) while ON. The server timestamp is the
  // source of truth; this is display only, so it works with the tab closed.
  useEffect(() => {
    if (!enabled || !nextRefreshAt) return;
    const tick = () =>
      setRemainingMs(new Date(nextRefreshAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, nextRefreshAt]);

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium">
      <RefreshCw className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
      <span>Auto-refresh list:</span>
      {enabled ? (
        <span className="flex items-center gap-1 text-zinc-600">
          <Check className="h-3.5 w-3.5 text-green-600" aria-label="on" />
          <span className="font-normal">
            {remainingMs > 0
              ? `Next refresh in ${formatCountdown(remainingMs)}`
              : "Refreshing soon…"}
          </span>
        </span>
      ) : (
        <X className="h-3.5 w-3.5 text-red-600" aria-label="off" />
      )}
    </div>
  );
}

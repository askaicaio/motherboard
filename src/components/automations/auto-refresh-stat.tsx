// Main Page card stat: "Auto-refresh:" + this platform's auto-refresh
// on/off state. Sits at the top of the card's stats (above Total / Active /
// Paused). The `enabled` flag comes from the server (the stored
// `automations_autorefresh` app-setting, the source of truth).
//
//   ON  -> green check
//   OFF -> red X

import { Check, Clock, X } from "lucide-react";

export function AutoRefreshStat({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium">
      <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
      <span>Auto-refresh:</span>
      {enabled ? (
        <Check className="h-3.5 w-3.5 text-green-600" aria-label="on" />
      ) : (
        <X className="h-3.5 w-3.5 text-red-600" aria-label="off" />
      )}
    </div>
  );
}

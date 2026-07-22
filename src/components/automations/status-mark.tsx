// Boxed status mark used on the Main Page cards: a filled, rounded square
// holding a white check or X (instead of a bare coloured glyph).
//
//   ok=true  -> green box, white check
//   ok=false -> red box, white X
//
// Shared by AutoRefreshStat and the "Days since last Error" placeholder so both
// marks stay visually identical.

import { Check, X } from "lucide-react";

export function StatusMark({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ${
        ok ? "bg-green-600" : "bg-red-600"
      }`}
      role="img"
      aria-label={label}
    >
      {ok ? (
        <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
      ) : (
        <X className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
      )}
    </span>
  );
}

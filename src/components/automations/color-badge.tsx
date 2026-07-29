// A dropdown-choice value rendered as a coloured pill, using its badge + text
// colour KEYS resolved to hex (inline style, so it's independent of the app's
// pale pill classes). Plain text when no badge colour is set. Used by the
// Trigger Event column on the Per Website + View All Lists tables; the same
// look as the Trigger Event config table's value pill.

import { choiceColorHex } from "@/lib/automations/dropdown-config";
import { cn } from "@/lib/utils";

export function ColorBadge({
  value,
  badgeColor,
  textColor,
  truncate = false,
}: {
  value: string;
  badgeColor?: string | null;
  textColor?: string | null;
  /** Single-line + ellipsis instead of wrapping. Used where the pill sits in a
   *  fixed-height row (e.g. a closed dropdown trigger). Tables leave this off so
   *  long values wrap and stay fully readable. */
  truncate?: boolean;
}) {
  const bg = choiceColorHex(badgeColor);
  if (!bg) {
    return (
      <span className={cn("text-xs text-zinc-700", truncate ? "truncate" : "break-words")}>
        {value}
      </span>
    );
  }
  const fg = choiceColorHex(textColor) ?? "#111827";
  return (
    <span
      className={cn(
        "inline-block rounded-md px-3 py-0.5 text-xs font-medium",
        truncate ? "max-w-full truncate" : "break-words",
      )}
      style={{ backgroundColor: bg, color: fg, border: "1px solid rgba(0,0,0,0.08)" }}
    >
      {value}
    </span>
  );
}

"use client";

// The amber "(N)" that leads a multi-value cell: GHL Tags, GHL Forms and
// Webhook Links on both tables, and the Relationships column on the Dropdown
// Configuration page.
//
// ⚠️ WHY THIS IS A COMPONENT AND WHY IT USES <Tooltip>, NOT `title`.
//
// The count always sits INSIDE a button that already carries its own `title`
// (the row's URL, or the shared-with text). A native `title` on the count
// therefore never wins: the browser shows the button's, on its own ~1s timing.
// That was the bug, reported twice, and it looked like "the tooltip is
// missing" rather than "the wrong tooltip is showing".
//
// A <Tooltip> is a separate mechanism, so it does not compete, and it obeys
// TOOLTIP_DELAY_MS like everything else. The trigger renders a SPAN, so no
// interactive element is nested inside the button and the click that opens the
// lookup still gets through.
//
// Seven call sites shared one copy-paste of this before; they now share this.

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RelatedCount({
  count,
  tooltip,
}: {
  count: number;
  /** What the number counts. Differs per column, so the caller supplies it:
   *  a Relationships count means "automations using this choice", while a
   *  Webhook Links count means "links on this automation". */
  tooltip: ReactNode;
}) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <span className="font-medium text-amber-600">({count}) </span>
        }
      />
      <TooltipContent className="max-w-xs normal-case">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Tooltip text for a per-row cell count (GHL Tags / GHL Forms / Webhook Links
 *  on either table): how many entries this automation has in that column, and
 *  the fact that the cell is clamped so not all of them are on screen. */
export function cellCountTooltip(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"} on this automation. Only the lines that fit are shown.`;
}

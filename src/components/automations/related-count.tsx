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
 *  on either table): how many entries this automation has in that column.
 *
 *  ⚠️ `columnName` is the COLUMN'S OWN LABEL, used verbatim and NOT pluralised,
 *  which is why this takes a column name rather than a singular noun. The user
 *  set this wording on 2026-08-28 ("2 Webhook Links on this automation.") and
 *  asked for the same shape on GHL Tags and GHL Forms. Naming the column the
 *  way the header does is the point, so a count of 1 reads "1 Webhook Links".
 *
 *  The earlier version pluralised a singular noun and added a second sentence
 *  about the cell being clamped; the user replaced it with this. Do not add the
 *  clamp sentence back. */
export function cellCountTooltip(count: number, columnName: string): string {
  return `${count} ${columnName} on this automation.`;
}

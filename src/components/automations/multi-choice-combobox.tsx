"use client";

// Searchable MULTI-select picker for a dropdown-driven Per Website column
// (Automation Tags first). The multi-value sibling of SingleChoiceCombobox:
// type-to-filter over the column's configured choices, toggle any number on/off
// (the popover stays open), and see the selected set as coloured chips on the
// trigger. Built generically off ChoiceOption so the other multi-select columns
// (GHL Tags, GHL Forms) can reuse it.
//
// Selected options are PINNED (sticky) at the top of the open list, just below the
// frozen search bar, so the current selection stays visible while the rest of the
// list scrolls; the unselected options are the normal searchable list below.
// Unselecting an item drops it back into that list.
//
// `values` is the selected choice ids; `onChange` hands back the next id array.

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePopoverSide } from "./use-popover-side";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { choiceColorHex, type ChoiceOption } from "@/lib/automations/dropdown-config";
import { ColorBadge } from "./color-badge";

export function MultiChoiceCombobox({
  options,
  values,
  onChange,
  id,
  searchPlaceholder = "Search…",
  emptyLabel = "None",
  noResultsLabel = "No options found.",
  side = "right",
}: {
  options: ChoiceOption[];
  /** Selected choice ids (order preserved as given). */
  values: string[];
  onChange: (values: string[]) => void;
  id?: string;
  searchPlaceholder?: string;
  /** Shown (in red) on the trigger when nothing is selected. */
  emptyLabel?: string;
  noResultsLabel?: string;
  /** Which side the popover opens on (default right). Pass "left" for a
   *  left-column field so the menu opens away from the dialog. */
  side?: "left" | "right" | "top" | "bottom";
}) {
  // Open state + resolved orientation. `side` (the prop) is the PREFERRED side;
  // the hook opens vertically instead when that side is too narrow, and hands
  // back the collisionAvoidance to match (pinned when horizontal).
  const { triggerRef, open, setOpen, side: resolvedSide, collisionAvoidance } =
    usePopoverSide(side);
  const selectedSet = new Set(values);
  // Split into selected (pinned at the top of the list) and unselected (the
  // normal, searchable list below). Both keep the configured (alphabetical) order.
  const selected = options.filter((o) => selectedSet.has(o.id));
  const unselected = options.filter((o) => !selectedSet.has(o.id));

  function toggle(choiceId: string) {
    if (selectedSet.has(choiceId)) {
      onChange(values.filter((v) => v !== choiceId));
    } else {
      onChange([...values, choiceId]);
    }
  }

  // The inner content of an option row (checkbox + coloured pill / plain text),
  // shared by the pinned selected rows and the unselected list items so both look
  // identical.
  function optionInner(o: ChoiceOption, checked: boolean) {
    return (
      <>
        <span
          className={cn(
            "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </span>
        {choiceColorHex(o.badgeColor) ? (
          <ColorBadge
            value={o.value}
            badgeColor={o.badgeColor}
            textColor={o.textColor}
          />
        ) : (
          // min-w-0 lets this flex child shrink so `truncate` can ellipsis a long
          // value (webhook URL) once the popover hits its width cap.
          <span className="min-w-0 truncate">{o.value}</span>
        )}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={triggerRef}
        id={id}
        type="button"
        className={cn(
          // Clearer zinc-300 resting border + faint shadow-sm. Focus MATCHES the
          // shared text inputs (the ring), NOT a border-colour change: same
          // `outline-none` + focus-visible ring classes as <Input>/<Textarea>.
          // ALSO show the ring while the popover is OPEN (data-popup-open): a
          // click moves focus into the popover, so focus-visible alone never
          // shows on click — the open-state ring is the "clicked/active" cue.
          "flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-left text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50",
          // Empty = the red "None" treatment, matching the table cell's red
          // "None" for an unset value (same as the single-select combobox).
          selected.length === 0 && "font-medium text-red-600",
        )}
      >
        {selected.length === 0 ? (
          <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
        ) : (
          // Selected tags as their coloured chips; wrap to multiple lines when
          // there are many (ColorBadge caps + wraps a long chip on its own).
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selected.map((o) => (
              <ColorBadge
                key={o.id}
                value={o.value}
                badgeColor={o.badgeColor}
                textColor={o.textColor}
              />
            ))}
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </PopoverTrigger>
      {/* Opens to the side of the trigger (aligned to its top), NOT below, so the
          long multi-select list doesn't cover the dialog fields underneath while
          it stays open for picking. `side` defaults to right; left-column fields
          pass "left" so the menu opens outward. When that side is too narrow,
          usePopoverSide switches `resolvedSide` to "bottom" — see that hook.
          WIDTH: grows in the chosen direction only as wide as the longest option
          needs, capped at the space between the trigger and the window edge (Base
          UI's --available-width on the Positioner, less ~0.5rem so it doesn't touch
          the edge). Long options (e.g. webhook URLs) then truncate at that cap.
          The floor is min(18rem, that cap): normally 18rem (the old w-72 width),
          but on a width-constrained screen where less than 18rem is available the
          floor SHRINKS to the cap too — otherwise a fixed min-width would beat the
          max-width (CSS resolves min over max) and push the box off the screen edge
          instead of shrinking. The 100vw fallback keeps the calc valid on the first
          paint before --available-width is set.
          collisionAvoidance comes from the hook: side "none" (PIN) while
          horizontal so Base UI can't flip off the chosen side before it computes
          --available-width (which would let a wide w-max box sprawl and stop the
          cap binding); flip+shift while vertical (bottom<->top + on-screen nudge). */}
      <PopoverContent
        className="min-w-[min(18rem,calc(var(--available-width,100vw)_-_0.5rem))] w-max max-w-[calc(var(--available-width,100vw)_-_0.5rem)] p-0"
        side={resolvedSide}
        align="start"
        sideOffset={8}
        collisionAvoidance={collisionAvoidance}
      >
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          {/* Grow the option list to the space between the trigger and the
              window edge (Base UI's --available-height, set on the Positioner),
              scrolling only past that — instead of the shared list's fixed
              max-h-72 (~7 rows). Subtract ~3rem for the pinned search box above
              so the popup as a whole stays inside the viewport. */}
          <CommandList className="max-h-[calc(var(--available-height)_-_3rem)]">
            {/* SELECTED items pinned/frozen just below the search bar: `sticky
                top-0` keeps them at the top of the scroll area so they stay visible
                while the unselected list scrolls under them (like the search bar
                stays frozen above). Plain buttons, NOT cmdk items, so they are not
                filtered by the search: every selection stays visible. Click one to
                unselect it and it drops back into the normal list below. Own
                max-height + scroll so a big selection can't eat the whole popup. */}
            {selected.length > 0 && (
              <div className="sticky top-0 z-10 max-h-40 overflow-y-auto border-b bg-popover p-1">
                {selected.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {optionInner(o, true)}
                  </button>
                ))}
              </div>
            )}
            {unselected.length > 0 ? (
              <>
                <CommandEmpty>{noResultsLabel}</CommandEmpty>
                <CommandGroup>
                  {unselected.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={o.value}
                      // Toggle without closing, so several can be picked in one
                      // open (this is the multi-select behaviour).
                      onSelect={() => toggle(o.id)}
                    >
                      {optionInner(o, false)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              selected.length > 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  All options selected.
                </div>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

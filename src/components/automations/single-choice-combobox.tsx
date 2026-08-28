"use client";

// Searchable SINGLE-select picker for a dropdown-driven Per Website column.
// Type-to-filter over the column's configured choices (case-insensitive),
// keyboard-navigable (cmdk). One value at a time; a first "None" row clears the
// selection (the column is optional). Modeled on the Partner Program's
// PartnerCombobox (Popover + Command). Multi-select columns get their own
// component later; this one is deliberately single-value.
//
// `value` is the selected choice id ("" = nothing selected); `onChange` hands
// back the chosen id (or "" when cleared).

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

export function SingleChoiceCombobox({
  options,
  value,
  onChange,
  id,
  searchPlaceholder = "Search…",
  emptyLabel = "None",
  noResultsLabel = "No options found.",
  side = "right",
}: {
  options: ChoiceOption[];
  /** Selected choice id, or "" for nothing selected. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  searchPlaceholder?: string;
  /** The first row that clears the selection (also shown on the trigger when
   *  nothing is selected). */
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
  const selected = value === "" ? null : options.find((o) => o.id === value) ?? null;
  // Colour-bearing option (Trigger Event) → show its pill on the closed trigger.
  // Author options have no badge colour, so this is null and they stay plain.
  const selectedHex = selected ? choiceColorHex(selected.badgeColor) : null;

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
          // "None" for an unset value.
          value === "" && "font-medium text-red-600",
        )}
      >
        {selected && selectedHex ? (
          // Selected colour-bearing value → render it as its pill (truncating so
          // the trigger stays a single line).
          <ColorBadge
            value={selected.value}
            badgeColor={selected.badgeColor}
            textColor={selected.textColor}
            truncate
          />
        ) : (
          <span className="min-w-0 truncate">
            {selected ? selected.value : emptyLabel}
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </PopoverTrigger>
      {/* Opens to the side of the trigger (aligned to its top), NOT below, so it
          doesn't cover the dialog fields underneath while open. `side` defaults
          to right; left-column fields pass "left" so the menu opens outward. When
          that side is too narrow, usePopoverSide switches `resolvedSide` to
          "bottom" (opening vertically instead) — see that hook.
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
            <CommandEmpty>{noResultsLabel}</CommandEmpty>
            <CommandGroup>
              {/* Clear row: always present so an optional column can be unset. */}
              <CommandItem
                value={emptyLabel}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="font-medium text-red-600">{emptyLabel}</span>
                {value === "" && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.value}
                  // Hovering reveals the WHOLE value. These rows truncate by
                  // design once the popover hits its width cap (see the comment
                  // on the cap above, which names webhook URLs), leaving no way
                  // to read a long option in full. Native title, matching how the
                  // Dropdown Config Relationships cells already expose a
                  // truncated URL.
                  title={o.value}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  {/* Colour-bearing option → show its pill so it's easy to spot
                      while scrolling; otherwise plain text (unchanged Author). */}
                  {choiceColorHex(o.badgeColor) ? (
                    <ColorBadge
                      value={o.value}
                      badgeColor={o.badgeColor}
                      textColor={o.textColor}
                    />
                  ) : (
                    // min-w-0 lets this flex child shrink so `truncate` can
                    // ellipsis a long value once the popover hits its width cap.
                    <span className="min-w-0 truncate">{o.value}</span>
                  )}
                  {value === o.id && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

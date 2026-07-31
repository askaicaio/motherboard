"use client";

// Searchable MULTI-select picker for a dropdown-driven Per Website column
// (Automation Tags first). The multi-value sibling of SingleChoiceCombobox:
// type-to-filter over the column's configured choices, toggle any number on/off
// (the popover stays open), and see the selected set as coloured chips on the
// trigger. Built generically off ChoiceOption so the other multi-select columns
// (GHL Tags, GHL Forms) can reuse it.
//
// `values` is the selected choice ids; `onChange` hands back the next id array.

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(values);
  // Preserve the configured (alphabetical) option order in the chip row.
  const selected = options.filter((o) => selectedSet.has(o.id));

  function toggle(choiceId: string) {
    if (selectedSet.has(choiceId)) {
      onChange(values.filter((v) => v !== choiceId));
    } else {
      onChange([...values, choiceId]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
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
          pass "left" so the menu opens outward. Base UI auto-flips if that side
          lacks room. Fixed width (not the full trigger width). */}
      <PopoverContent
        className="w-72 p-0"
        side={side}
        align="start"
        sideOffset={8}
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
              {options.map((o) => {
                const checked = selectedSet.has(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    value={o.value}
                    // Toggle without closing, so several tags can be picked in
                    // one open (this is the multi-select behaviour).
                    onSelect={() => toggle(o.id)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300",
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
                      <span className="truncate">{o.value}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

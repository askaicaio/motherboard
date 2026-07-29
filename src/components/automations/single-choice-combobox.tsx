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

export function SingleChoiceCombobox({
  options,
  value,
  onChange,
  id,
  searchPlaceholder = "Search…",
  emptyLabel = "None",
  noResultsLabel = "No options found.",
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
}) {
  const [open, setOpen] = useState(false);
  const selected = value === "" ? null : options.find((o) => o.id === value) ?? null;
  // Colour-bearing option (Trigger Event) → show its pill on the closed trigger.
  // Author options have no badge colour, so this is null and they stay plain.
  const selectedHex = selected ? choiceColorHex(selected.badgeColor) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-sm",
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
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
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
                    <span className="truncate">{o.value}</span>
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

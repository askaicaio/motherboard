"use client";

// Add / Edit dialog for a Dropdown Configuration choice. One component, two
// modes (add when initialValue is ""). Presentational: the parent's onSubmit
// performs the create/update and returns an error message (or null on success).
// The GHL Tags table passes showStatus + showNotes to render a Status dropdown
// and a Purpose-style Notes textarea alongside the value field. Modeled on the
// Automations "Add/Edit Workflow" dialog.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHOICE_COLOR_OPTIONS,
  choiceColorHex,
  type StatusOption,
} from "@/lib/automations/dropdown-config";
import {
  usePopoverSide,
  NARROW_SIDE_SPACE_SELECT_PX,
} from "./use-popover-side";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { Loader2, Trash2 } from "lucide-react";

export interface ChoiceSubmit {
  value: string;
  status?: string;
  notes?: string;
  badgeColor?: string | null;
  textColor?: string | null;
}

/** A compact swatch picker: an optional "none" chip + one circle per palette
 *  colour; the selected swatch gets a ring. Value is the colour key ("" = none).
 *  `disabled` dims the whole section and blocks interaction. */
function ColorSwatchPicker({
  label,
  value,
  onChange,
  options = CHOICE_COLOR_OPTIONS,
  showNone = true,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (key: string) => void;
  options?: typeof CHOICE_COLOR_OPTIONS;
  showNone?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "pointer-events-none opacity-40")}>
      <Label>{label}</Label>
      {/* Fixed 15 swatches per row (grid), so the palette always lays out the
          same regardless of how many colours there are. Swatches fill their
          column (aspect-square), so 15 fit at any dialog width. */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
      >
        {options.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            disabled={disabled}
            aria-label={c.label}
            title={c.label}
            className={cn(
              "aspect-square w-full rounded-full",
              value === c.key && "ring-2 ring-zinc-900 ring-offset-1",
            )}
            style={{ backgroundColor: c.hex, border: "1px solid rgba(0,0,0,0.12)" }}
          />
        ))}
        {/* "None" chip last (at the very end of the grid). */}
        {showNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            aria-label="None"
            title="None"
            className={cn(
              "flex aspect-square w-full items-center justify-center rounded-full border border-zinc-300 text-[11px] text-zinc-400",
              value === "" && "ring-2 ring-zinc-900 ring-offset-1",
            )}
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  isUrl: boolean;
  initialValue: string;
  /** Built-in options ("No Path", "No Tag", ...) are recognised by their value,
   *  so the value cannot change without the option ceasing to be one. Renders
   *  the field read-only and says why. The API blocks the rename regardless. */
  valueLocked?: boolean;
  /** Built-in options carry the admin-only status, which is not a choice anyone
   *  may change. Renders it as a read-only pill instead of a Select. The API
   *  refuses the change regardless. */
  statusLocked?: boolean;
  submitLabel: string;
  /** Show a Status dropdown (status-bearing columns: GHL Tags, GHL Forms,
   *  Author). Each option carries its own text tone. */
  showStatus?: boolean;
  statusOptions?: StatusOption[];
  initialStatus?: string;
  /** Show a Purpose-style Notes textarea (GHL Tags). */
  showNotes?: boolean;
  initialNotes?: string;
  /** Show Badge Color + Text Color swatch pickers (Trigger Event). */
  showColors?: boolean;
  initialBadgeColor?: string;
  initialTextColor?: string;
  /** Performs the save. Resolves to an error message, or null on success. */
  onSubmit: (payload: ChoiceSubmit) => Promise<string | null>;
  /** EDIT MODE ONLY. Deletes the option being edited (confirm + DELETE + toast
   *  live in the caller, which also closes this dialog on success). Omit in add
   *  mode, and on a BUILT-IN option, and the button is hidden. Mirrors
   *  WorkflowDialog's onDelete exactly. */
  onDelete?: () => void;
}

export function ChoiceDialog({
  open,
  onOpenChange,
  heading,
  description,
  fieldLabel,
  placeholder,
  isUrl,
  initialValue,
  valueLocked = false,
  statusLocked = false,
  submitLabel,
  showStatus,
  statusOptions,
  initialStatus,
  showNotes,
  initialNotes,
  showColors,
  initialBadgeColor,
  initialTextColor,
  onSubmit,
  onDelete,
}: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [badgeColor, setBadgeColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Status dropdown orientation (standard dropdown behaviour): opens to the RIGHT
  // pinned, or vertically when that side is too narrow. Small fixed-width menu, so
  // it uses the smaller Select threshold. Hook is called unconditionally (only its
  // outputs are used inside the showStatus block below).
  const {
    triggerRef: statusTriggerRef,
    open: statusOpen,
    setOpen: setStatusOpen,
    side: statusSide,
    collisionAvoidance: statusCollisionAvoidance,
  } = usePopoverSide("right", NARROW_SIDE_SPACE_SELECT_PX);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setStatus(initialStatus ?? "");
    setNotes(initialNotes ?? "");
    setBadgeColor(initialBadgeColor ?? "");
    setTextColor(initialTextColor ?? "");
    setError(null);
  }, [open, initialValue, initialStatus, initialNotes, initialBadgeColor, initialTextColor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`${fieldLabel} is required`);
      return;
    }
    if (isUrl) {
      try {
        new URL(trimmed);
      } catch {
        setError("Enter a valid URL (including https://)");
        return;
      }
    }
    setSubmitting(true);
    try {
      const err = await onSubmit({
        value: trimmed,
        ...(showStatus ? { status } : {}),
        ...(showNotes ? { notes } : {}),
        // No badge colour → no pill, so clear both. Badge set but no explicit
        // text colour → default it to black (the effective default), so the
        // stored value matches what the picker shows + what renders.
        ...(showColors
          ? {
              badgeColor: badgeColor || null,
              textColor: badgeColor ? textColor || "black" : null,
            }
          : {}),
      });
      if (err) {
        setError(err);
        return;
      }
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Its own TooltipProvider, for the delete button's tooltip. The Dropdown
    // Config page has one, but this dialog is a separate mount and owning one
    // keeps it working regardless of where it is opened from, exactly as
    // WorkflowDialog does.
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
    <Dialog
      open={open}
      onOpenChange={(isOpen, eventDetails) => {
        // Don't dismiss on an outside/backdrop click or focus loss.
        if (
          !isOpen &&
          (eventDetails?.reason === "outside-press" ||
            eventDetails?.reason === "focus-out")
        ) {
          return;
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col",
          // A touch wider for the colour tables so the 15-per-row swatch grid
          // has comfortable room; other tables stay compact.
          showColors ? "sm:max-w-lg" : "sm:max-w-md",
        )}
        overlayClassName="bg-black/70"
      >
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Fields scroll together when the dialog gets tall (e.g. a long Notes
              value); the header + footer stay pinned so the buttons are always
              reachable. Mirrors the Per Website Add/Edit Workflow dialog.
              (-mx-1/px-1 gives focus rings room so they don't trigger a
              horizontal scrollbar.) */}
          <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-3">
          <div className="space-y-1.5">
            <Label htmlFor="choice-value">{fieldLabel}</Label>
            <Input
              id="choice-value"
              type={isUrl ? "url" : "text"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              // A locked field must not steal focus from the fields that CAN
              // still be edited (Status, Notes), so autoFocus moves off it.
              autoFocus={!valueLocked}
              readOnly={valueLocked}
              maxLength={isUrl ? 1000 : 300}
              placeholder={placeholder}
              className={cn(
                "border-zinc-300 shadow-sm",
                // readOnly is a BEHAVIOUR change, not a visual one, so the
                // muted look and the cursor have to be said out loud.
                valueLocked &&
                  "cursor-default bg-zinc-50 text-zinc-500 focus-visible:ring-0",
              )}
            />
            {valueLocked && (
              <p className="text-xs text-zinc-500">
                Built-in option. The name cannot be changed, and it cannot be
                removed. Everything else here is still editable.
              </p>
            )}
          </div>
          {showStatus && statusLocked && (
            <div className="space-y-1.5">
              <Label htmlFor="choice-status">Status</Label>
              {/* A read-only PILL, not a disabled Select. The status of a
                  built-in option is not a choice anyone declined to make, so
                  offering a control at all would misdescribe it. Rendered from
                  the same StatusOption tones the tables use, so it looks
                  identical to the badge on the row behind this dialog. */}
              <div id="choice-status">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    (statusOptions ?? []).find((o) => o.value === status)
                      ?.badge ?? "bg-zinc-100 text-zinc-700",
                  )}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Reserved for built-in options and not selectable elsewhere.
              </p>
            </div>
          )}
          {showStatus && !statusLocked && (
            <div className="space-y-1.5">
              <Label htmlFor="choice-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v ?? "")}
                open={statusOpen}
                onOpenChange={(o) => setStatusOpen(o)}
              >
                {/* Clearer field look (matches the other Add/Edit fields): zinc-300
                    resting border + shadow-sm. Keeps the shared SelectTrigger's
                    built-in focus ring AND shows it while the menu is open
                    (data-popup-open), so a click activates the ring like the other
                    dropdowns. Per-instance override so selects elsewhere are
                    unaffected. */}
                <SelectTrigger
                  ref={statusTriggerRef}
                  id="choice-status"
                  className="w-44 border-zinc-300 shadow-sm data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50"
                >
                  <SelectValue
                    placeholder="Status"
                    className={
                      (statusOptions ?? []).find((o) => o.value === status)?.text
                    }
                  />
                </SelectTrigger>
                {/* Standard dropdown behaviour (via usePopoverSide): opens to the
                    RIGHT pinned, or vertically when that side is too narrow.
                    alignItemWithTrigger={false} is required for `side` to take
                    effect on a Base UI Select. */}
                <SelectContent
                  side={statusSide}
                  align="start"
                  sideOffset={8}
                  alignItemWithTrigger={false}
                  collisionAvoidance={statusCollisionAvoidance}
                >
                  {(statusOptions ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value} className={o.text}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showColors && (
            <>
              {/* Live preview: the value rendered as a pill with the currently
                  selected badge + text colours (updates as you type / pick).
                  Plain text until a badge colour is chosen. */}
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div>
                  {badgeColor ? (
                    <span
                      // max-w-full + [overflow-wrap:anywhere] so a long unbroken
                      // token wraps inside the dialog instead of stretching the
                      // pill — see [[long-word-overflow-wrap-anywhere]].
                      className="inline-block max-w-full [overflow-wrap:anywhere] rounded-md px-3 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: choiceColorHex(badgeColor),
                        color: choiceColorHex(textColor) ?? "#111827",
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {value.trim() || "Preview"}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-700">
                      {value.trim() || "Preview"}
                    </span>
                  )}
                </div>
              </div>
              <ColorSwatchPicker
                label="Badge color"
                value={badgeColor}
                onChange={(k) => {
                  setBadgeColor(k);
                  setError(null);
                }}
              />
              {/* Text colour: no "none" chip (unset = black anyway, so Black
                  takes that slot). Disabled + dimmed when there's no badge colour,
                  since the pill (and thus its text colour) isn't shown then.
                  Defaults the highlight to Black when unset. */}
              <ColorSwatchPicker
                label="Text color"
                value={textColor || "black"}
                onChange={(k) => {
                  setTextColor(k);
                  setError(null);
                }}
                showNone={false}
                disabled={badgeColor === ""}
              />
            </>
          )}
          {showNotes && (
            <div className="space-y-1.5">
              <Label htmlFor="choice-notes">Notes</Label>
              <Textarea
                id="choice-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setError(null);
                }}
                maxLength={5000}
                rows={3}
                placeholder="Optional note…"
                className="border-zinc-300 shadow-sm block resize-none overflow-hidden [overflow-wrap:anywhere]"
              />
            </div>
          )}
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          </div>
          <DialogFooter className="shrink-0">
            {/* Delete, bottom-left, replacing the per-row bin the config tables
                used to carry. Copied from WorkflowDialog: same icon, same red,
                same `sm:mr-auto` to push it away from Cancel / Save, same
                type="button" so it never submits the form, and the confirm +
                request live in the caller. It is absent in add mode and on a
                built-in option, because the caller only passes onDelete when
                deleting is actually allowed. */}
            {onDelete && (
              <Tooltip disableHoverablePopup>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={submitting}
                      aria-label="Delete this option"
                      className="inline-flex size-8 shrink-0 items-center justify-center self-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50 sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
                <TooltipContent className="max-w-xs">
                  Removes this option from the list. Any automation currently
                  using it loses that value.
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}

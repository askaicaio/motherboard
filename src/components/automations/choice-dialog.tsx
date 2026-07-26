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
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ChoiceSubmit {
  value: string;
  status?: string;
  notes?: string;
  badgeColor?: string | null;
  textColor?: string | null;
}

/** Text-colour swatch order: Black first (it takes the old "none" slot, since an
 *  unset text colour renders black anyway), then the rest of the palette. */
const TEXT_COLOR_OPTIONS = [
  ...CHOICE_COLOR_OPTIONS.filter((c) => c.key === "black"),
  ...CHOICE_COLOR_OPTIONS.filter((c) => c.key !== "black"),
];

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
      <div className="flex flex-wrap gap-1.5">
        {showNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            aria-label="None"
            title="None"
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[11px] text-zinc-400",
              value === "" && "ring-2 ring-zinc-900 ring-offset-1",
            )}
          >
            &times;
          </button>
        )}
        {options.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            disabled={disabled}
            aria-label={c.label}
            title={c.label}
            className={cn(
              "h-6 w-6 rounded-full",
              value === c.key && "ring-2 ring-zinc-900 ring-offset-1",
            )}
            style={{ backgroundColor: c.hex, border: "1px solid rgba(0,0,0,0.12)" }}
          />
        ))}
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
}: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [badgeColor, setBadgeColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        className="flex max-h-[85vh] flex-col sm:max-w-md"
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
              autoFocus
              maxLength={isUrl ? 1000 : 300}
              placeholder={placeholder}
            />
          </div>
          {showStatus && (
            <div className="space-y-1.5">
              <Label htmlFor="choice-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
                <SelectTrigger id="choice-status" className="w-44">
                  <SelectValue
                    placeholder="Status"
                    className={
                      (statusOptions ?? []).find((o) => o.value === status)?.text
                    }
                  />
                </SelectTrigger>
                <SelectContent>
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
                      className="inline-block break-words rounded-md px-3 py-0.5 text-xs font-medium"
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
                options={TEXT_COLOR_OPTIONS}
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
                className="block resize-none overflow-hidden [overflow-wrap:anywhere]"
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
  );
}

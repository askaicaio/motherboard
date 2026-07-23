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
import { Loader2 } from "lucide-react";

export interface ChoiceSubmit {
  value: string;
  status?: string;
  notes?: string;
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
  /** Show a Status dropdown (GHL Tags). */
  showStatus?: boolean;
  statusOptions?: readonly string[];
  initialStatus?: string;
  /** Show a Purpose-style Notes textarea (GHL Tags). */
  showNotes?: boolean;
  initialNotes?: string;
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
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setStatus(initialStatus ?? "");
    setNotes(initialNotes ?? "");
    setError(null);
  }, [open, initialValue, initialStatus, initialNotes]);

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
      <DialogContent className="sm:max-w-md" overlayClassName="bg-black/70">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
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
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {(statusOptions ?? []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <DialogFooter>
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

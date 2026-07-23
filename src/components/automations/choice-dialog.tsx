"use client";

// Add / Edit dialog for a single Dropdown Configuration choice. One component,
// two modes, driven by `initialValue` (empty = add). It is presentational: the
// parent passes an `onSubmit(value)` that performs the create/update fetch and
// returns an error message (or null on success). Modeled on the Automations
// "Add/Edit Workflow" dialog.

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Add Author" / "Edit Webhook link". */
  heading: string;
  description: string;
  /** Field label, e.g. "Author" / "Webhook URL". */
  fieldLabel: string;
  placeholder: string;
  /** true → validate + type the field as a URL. */
  isUrl: boolean;
  /** Existing value when editing; "" when adding. */
  initialValue: string;
  submitLabel: string;
  /** Performs the save. Resolves to an error message, or null on success. */
  onSubmit: (value: string) => Promise<string | null>;
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
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError(null);
  }, [open, initialValue]);

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
      const err = await onSubmit(trimmed);
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
        // Don't dismiss on an outside/backdrop click or focus loss, that would
        // lose typed work on a misclick. Esc, the ✕, Cancel, and a successful
        // save still close the dialog.
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

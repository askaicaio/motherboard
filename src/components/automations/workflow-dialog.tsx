"use client";

// Add / Edit Workflow dialog. One component, two modes:
//  - Add  (no `existing`):  header "Add New Workflow",  button "Add Workflow"
//  - Edit (with `existing`): header "Edit Workflow",     button "Save changes"
// Fields mirror the automations table columns (currently Name + Link). Add a
// labeled field here whenever a new column is added to the table.
// Modeled on the Subscriptions tab's Add/Edit subscription dialog.

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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AutomationRow } from "./automations-table-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which website the new automation belongs to (used on create). */
  platform: string;
  /** Present → edit mode; absent → add mode. */
  existing?: AutomationRow;
  onCreated?: (row: AutomationRow) => void;
  onSaved?: (row: AutomationRow) => void;
}

export function WorkflowDialog({
  open,
  onOpenChange,
  platform,
  existing,
  onCreated,
  onSaved,
}: Props) {
  const isEdit = !!existing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  // Status defaults to "paused" for new automations.
  const [status, setStatus] = useState("paused");
  // Purpose is an optional free-text note.
  const [purpose, setPurpose] = useState("");
  // Inline error shown as red text inside the dialog (e.g. duplicate link).
  const [error, setError] = useState<string | null>(null);

  // Populate (edit) or clear (add) the fields whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setExternalUrl(existing?.externalUrl ?? "");
    setStatus(existing?.status ?? "paused");
    setPurpose(existing?.purpose ?? "");
    setError(null);
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Name is optional; Link is required.
    if (!externalUrl.trim()) {
      setError("Link is required");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = isEdit
        ? `/api/automations/${existing!.id}`
        : "/api/automations";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim() }
        : { platform, name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim() };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Parse defensively, an unexpected server error may not be JSON, and
      // we never want a failed save to fall through without a message.
      let data: { error?: string; automation?: AutomationRow } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.automation) {
        setError(data.error || `Save failed (${res.status})`);
        return;
      }

      const row: AutomationRow = {
        id: data.automation.id,
        name: data.automation.name,
        externalUrl: data.automation.externalUrl,
        status: data.automation.status,
        purpose: data.automation.purpose,
      };
      if (isEdit) {
        onSaved?.(row);
        toast.success("Saved");
      } else {
        onCreated?.(row);
        toast.success(row.name ? `Added ${row.name}` : "Added automation");
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
        // Don't dismiss on an outside/backdrop click or focus loss, that
        // would lose typed work on a misclick. Esc, the ✕, Cancel, and a
        // successful save still close the dialog.
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
        className="flex max-h-[85vh] flex-col sm:max-w-lg"
        overlayClassName="bg-black/70"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Workflow" : "Add New Workflow"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update any field. Only changed values are saved."
              : "Adds a new automation entry to the ledger."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* All fields scroll together when the dialog gets tall; the header
              and footer stay pinned. (-mx-1/px-1 gives focus rings room so they
              don't trigger a horizontal scrollbar.) */}
          <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-3">
          <div className="space-y-1.5">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={300}
              placeholder="e.g. New lead → Slack alert"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-url">
              {/* Wrapped in one element so the Label's flex `gap` doesn't
                  push the asterisk away from the word, keeps "Link*" tight. */}
              <span>
                Link<span className="text-red-600">*</span>
              </span>
            </Label>
            <Input
              id="wf-url"
              type="url"
              value={externalUrl}
              onChange={(e) => {
                setExternalUrl(e.target.value);
                setError(null);
              }}
              required
              maxLength={1000}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "paused")}>
              <SelectTrigger id="wf-status" className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <span className="text-green-600">Active</span>
                </SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-purpose">Purpose</Label>
            <Textarea
              id="wf-purpose"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setError(null);
              }}
              maxLength={5000}
              rows={3}
              placeholder="What this automation is for…"
              // `block` overrides the shared Textarea's base `display:flex`, which
              // was defeating its `field-sizing-content` (so it capped at the
              // available height and showed its OWN scrollbar). `overflow-hidden`
              // stops the textarea from ever scrolling itself, and `resize-none`
              // removes the manual resize grip - together they force all growth
              // into the outer fields scroll area, so there's a single scrollbar.
              // [overflow-wrap:anywhere] breaks over-long words.
              className="block resize-none overflow-hidden [overflow-wrap:anywhere]"
            />
          </div>
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
              {isEdit ? "Save changes" : "Add Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

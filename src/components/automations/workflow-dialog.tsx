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
import { Label } from "@/components/ui/label";
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

  // Populate (edit) or clear (add) the fields whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setExternalUrl(existing?.externalUrl ?? "");
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!externalUrl.trim()) {
      toast.error("Link is required");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = isEdit
        ? `/api/automations/${existing!.id}`
        : "/api/automations";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name: name.trim(), externalUrl: externalUrl.trim() }
        : { platform, name: name.trim(), externalUrl: externalUrl.trim() };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }

      const row: AutomationRow = {
        id: data.automation.id,
        name: data.automation.name,
        externalUrl: data.automation.externalUrl,
      };
      if (isEdit) {
        onSaved?.(row);
        toast.success("Saved");
      } else {
        onCreated?.(row);
        toast.success(`Added ${row.name}`);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Workflow" : "Add New Workflow"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update any field — only changed values are saved."
              : "Adds a new automation entry to the ledger."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={300}
              placeholder="e.g. New lead → Slack alert"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-url">Link</Label>
            <Input
              id="wf-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              required
              maxLength={1000}
              placeholder="https://…"
            />
          </div>
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
              {isEdit ? "Save changes" : "Add Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// Add / Edit Workflow dialog. One component, two modes:
//  - Add  (no `existing`):  header "Add New Workflow",  button "Add Workflow"
//  - Edit (with `existing`): header "Edit Workflow",     button "Save changes"
// Fields mirror the EDITABLE automations table columns (Name, Link, Status,
// Purpose). Add a labeled field here whenever a new *user-editable* column is
// added. Sync-only / import-only columns (Last Runtime, Last Edited) do NOT get
// a form field — they are carried through unchanged in the save payload below so
// editing other fields doesn't blank them.
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
import { SingleChoiceCombobox } from "./single-choice-combobox";
import { MultiChoiceCombobox } from "./multi-choice-combobox";
import type { ChoiceOption } from "@/lib/automations/dropdown-config";
import { cn } from "@/lib/utils";

/** The Status value as its badge pill: green capsule for Active, neutral gray
 *  for Paused. Same emerald/zinc convention as the table's Status column (just
 *  sized text-xs to sit in the dialog). Rendered in the Status dropdown's list
 *  items and on its closed trigger, so the colour reads at a glance. */
function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700",
      )}
    >
      {active ? "Active" : "Paused"}
    </span>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which website the new automation belongs to (used on create). */
  platform: string;
  /** Present → edit mode; absent → add mode. */
  existing?: AutomationRow;
  /** Configured Author options for the single-select Author dropdown. */
  authorChoices?: ChoiceOption[];
  /** Configured Trigger Event options for its single-select dropdown. */
  triggerEventChoices?: ChoiceOption[];
  /** Configured Automation Tags options for the multi-select chip picker. */
  automationTagChoices?: ChoiceOption[];
  onCreated?: (row: AutomationRow) => void;
  onSaved?: (row: AutomationRow) => void;
}

export function WorkflowDialog({
  open,
  onOpenChange,
  platform,
  existing,
  authorChoices = [],
  triggerEventChoices = [],
  automationTagChoices = [],
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
  // Notes is a second optional free-text note (mirrors Purpose).
  const [notes, setNotes] = useState("");
  // Author: the selected Author choice id ("" = none). Single-select dropdown.
  const [authorChoiceId, setAuthorChoiceId] = useState("");
  // Trigger Event: the selected choice id ("" = none). Single-select dropdown.
  const [triggerEventChoiceId, setTriggerEventChoiceId] = useState("");
  // Automation Tags: the selected tag choice ids (multi-select). Empty = none.
  const [automationTagChoiceIds, setAutomationTagChoiceIds] = useState<string[]>([]);
  // Inline error shown as red text inside the dialog (e.g. duplicate link).
  const [error, setError] = useState<string | null>(null);

  // Populate (edit) or clear (add) the fields whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setExternalUrl(existing?.externalUrl ?? "");
    setStatus(existing?.status ?? "paused");
    setPurpose(existing?.purpose ?? "");
    setNotes(existing?.notes ?? "");
    setAuthorChoiceId(existing?.authorChoiceId ?? "");
    setTriggerEventChoiceId(existing?.triggerEventChoiceId ?? "");
    setAutomationTagChoiceIds((existing?.automationTags ?? []).map((t) => t.id));
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
      // single-select ids: send the selected id, or null to clear it.
      const authorPayload = authorChoiceId || null;
      const triggerEventPayload = triggerEventChoiceId || null;
      const body = isEdit
        ? { name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, automationTagChoiceIds }
        : { platform, name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, automationTagChoiceIds };

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

      const saved = data.automation;
      // Author: the API returns the stored id; resolve the chosen option (value
      // + colours) from the loaded choices so the table cell updates (as its
      // coloured pill) without a reload.
      const savedAuthorChoiceId = saved.authorChoiceId ?? null;
      const savedAuthor = authorChoices.find((c) => c.id === savedAuthorChoiceId);
      // Trigger Event: resolve the chosen option (value + colours) the same way.
      const savedTriggerEvent = triggerEventChoices.find(
        (c) => c.id === saved.triggerEventChoiceId,
      );
      const row: AutomationRow = {
        id: saved.id,
        name: saved.name,
        externalUrl: saved.externalUrl,
        status: saved.status,
        purpose: saved.purpose,
        notes: saved.notes,
        authorChoiceId: savedAuthorChoiceId,
        author: savedAuthor?.value ?? null,
        authorBadgeColor: savedAuthor?.badgeColor ?? null,
        authorTextColor: savedAuthor?.textColor ?? null,
        triggerEventChoiceId: saved.triggerEventChoiceId ?? null,
        triggerEvent: savedTriggerEvent?.value ?? null,
        // Resolve the chosen option's colours too, so the pill shows immediately
        // (not just after a reload).
        triggerEventBadgeColor: savedTriggerEvent?.badgeColor ?? null,
        triggerEventTextColor: savedTriggerEvent?.textColor ?? null,
        // Automation Tags: resolve the selected ids to their choices (value +
        // colours) so the row's chips render immediately, without a reload.
        // Alphabetical by value to match the loader's ordering.
        automationTags: automationTagChoiceIds
          .map((tid) => automationTagChoices.find((c) => c.id === tid))
          .filter((c): c is ChoiceOption => !!c)
          .map((c) => ({
            id: c.id,
            value: c.value,
            badgeColor: c.badgeColor,
            textColor: c.textColor,
          }))
          .sort((a, b) => a.value.localeCompare(b.value)),
        // Sync-only fields, carried through so an edit doesn't blank them in the
        // table (not editable here; the API returns the current values).
        lastRunAt: saved.lastRunAt,
        lastEditedAt: saved.lastEditedAt,
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
            <Textarea
              id="wf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={300}
              rows={1}
              placeholder="e.g. New lead → Slack alert"
              // Grows with content (long names no longer get cut off), same
              // setup as the Purpose field: `block` overrides the shared
              // Textarea's base display:flex so `field-sizing-content` works;
              // `overflow-hidden` + `resize-none` push all growth into the
              // outer fields scroll area (single scrollbar, no manual grip).
              // [overflow-wrap:anywhere] breaks over-long unbroken strings.
              // `min-h-9` overrides the shared Textarea's tall `min-h-16` floor
              // so a short name starts at single-line height (like the old
              // Input) and only grows when the text actually needs it.
              className="block min-h-9 resize-none overflow-hidden [overflow-wrap:anywhere]"
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
              {/* Trigger + list items render the value as its StatusPill badge
                  (green Active / gray Paused), matching the table's Status
                  column. SelectValue's function child formats the closed
                  trigger; status always has a value ("paused" default), so the
                  fallback is just defensive. */}
              <SelectTrigger id="wf-status" className="w-40">
                <SelectValue placeholder="Status">
                  {(v) => (
                    <StatusPill status={typeof v === "string" ? v : "paused"} />
                  )}
                </SelectValue>
              </SelectTrigger>
              {/* Opens to the RIGHT of the trigger (not overlaying it), matching
                  the other Add/Edit dropdowns. alignItemWithTrigger={false} is
                  required for `side` to take effect on a Base UI Select (its
                  default native-like item-over-trigger alignment ignores side). */}
              <SelectContent
                side="right"
                align="start"
                sideOffset={8}
                alignItemWithTrigger={false}
              >
                <SelectItem value="active">
                  <StatusPill status="active" />
                </SelectItem>
                <SelectItem value="paused">
                  <StatusPill status="paused" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-author">Author</Label>
            {/* Single-select: pick ONE Author option from the configured
                choices (managed on the Dropdown Configuration page). Optional;
                the "None" row clears it. Searchable because the list can grow. */}
            <SingleChoiceCombobox
              id="wf-author"
              options={authorChoices}
              value={authorChoiceId}
              onChange={(v) => {
                setAuthorChoiceId(v);
                setError(null);
              }}
              searchPlaceholder="Search authors…"
              emptyLabel="None"
              noResultsLabel="No authors found."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-automation-tags">Automation Tags</Label>
            {/* Multi-select: pick ANY number of Automation Tags from the
                configured choices (managed on the Dropdown Configuration page).
                Optional; the trigger shows the selected tags as chips, red
                "None" when empty. Sits between Author and Trigger Event, matching
                the table column order. */}
            <MultiChoiceCombobox
              id="wf-automation-tags"
              options={automationTagChoices}
              values={automationTagChoiceIds}
              onChange={(v) => {
                setAutomationTagChoiceIds(v);
                setError(null);
              }}
              searchPlaceholder="Search tags…"
              emptyLabel="None"
              noResultsLabel="No tags found."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-trigger-event">Trigger Event</Label>
            {/* Single-select: pick ONE Trigger Event option from the configured
                choices (managed on the Dropdown Configuration page). Optional;
                the "None" row clears it. Mirrors the Author dropdown. */}
            <SingleChoiceCombobox
              id="wf-trigger-event"
              options={triggerEventChoices}
              value={triggerEventChoiceId}
              onChange={(v) => {
                setTriggerEventChoiceId(v);
                setError(null);
              }}
              searchPlaceholder="Search trigger events…"
              emptyLabel="None"
              noResultsLabel="No trigger events found."
            />
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
          <div className="space-y-1.5">
            {/* Notes: a second free-text note, mirrors the Purpose field above
                exactly (same textarea setup), just labelled "Notes". */}
            <Label htmlFor="wf-notes">Notes</Label>
            <Textarea
              id="wf-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError(null);
              }}
              maxLength={5000}
              rows={3}
              placeholder="Any extra notes…"
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

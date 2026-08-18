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
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AutomationRow } from "./automations-table-client";
import { SingleChoiceCombobox } from "./single-choice-combobox";
import { MultiChoiceCombobox } from "./multi-choice-combobox";
import {
  usePopoverSide,
  NARROW_SIDE_SPACE_SELECT_PX,
} from "./use-popover-side";
import { columnVisibleOnPlatform } from "@/lib/automations/dropdown-config";
import type { ChoiceOption } from "@/lib/automations/dropdown-config";

/** Status options rendered as COLOURED TEXT in the Status dropdown, mirroring
 *  the GHL Forms Status dropdown (green Active, neutral-gray Paused). Replaces
 *  the earlier filled pill, which read as cramped in the side-opening popup. */
const WF_STATUS_OPTIONS = [
  { value: "active", label: "Active", text: "text-emerald-700" },
  { value: "paused", label: "Paused", text: "text-zinc-700" },
];

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
  /** Configured GHL Tags options (multi-select; only used on the GHL pages). */
  ghlTagChoices?: ChoiceOption[];
  /** Configured GHL Forms options (multi-select; only used on the GHL pages). */
  ghlFormChoices?: ChoiceOption[];
  /** Configured Webhook Links options (URL as value) for the multi-select picker. */
  webhookChoices?: ChoiceOption[];
  onCreated?: (row: AutomationRow) => void;
  onSaved?: (row: AutomationRow) => void;
  /** EDIT MODE ONLY. Deletes the automation being edited (confirm + DELETE +
   *  toast live in the caller, which also closes this dialog on success). Omit
   *  in add mode — there is nothing to delete yet — and the button is hidden. */
  onDelete?: () => void;
}

export function WorkflowDialog({
  open,
  onOpenChange,
  platform,
  existing,
  authorChoices = [],
  triggerEventChoices = [],
  automationTagChoices = [],
  ghlTagChoices = [],
  ghlFormChoices = [],
  webhookChoices = [],
  onCreated,
  onSaved,
  onDelete,
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
  // GHL Tags + GHL Forms: selected choice ids (multi-select, GHL pages only).
  const [ghlTagChoiceIds, setGhlTagChoiceIds] = useState<string[]>([]);
  const [ghlFormChoiceIds, setGhlFormChoiceIds] = useState<string[]>([]);
  // Webhook Links: the selected webhook choice ids (multi-select). Empty = none.
  const [webhookChoiceIds, setWebhookChoiceIds] = useState<string[]>([]);
  // Inline error shown as red text inside the dialog (e.g. duplicate link).
  const [error, setError] = useState<string | null>(null);
  // GHL Tags + GHL Forms are GHL-only fields, shown only when this automation's
  // platform is a GoHighLevel page (same gate as the table columns).
  const showGhlTags = columnVisibleOnPlatform("ghl_tags", platform);
  const showGhlForms = columnVisibleOnPlatform("ghl_forms", platform);
  // Status dropdown orientation (standard dropdown behaviour): Status is a
  // LEFT-column field, so it opens LEFT pinned, or vertically when that side is
  // too narrow. Small fixed-width menu → the smaller Select threshold.
  const {
    triggerRef: statusTriggerRef,
    open: statusOpen,
    setOpen: setStatusOpen,
    side: statusSide,
    collisionAvoidance: statusCollisionAvoidance,
  } = usePopoverSide("left", NARROW_SIDE_SPACE_SELECT_PX);

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
    setGhlTagChoiceIds((existing?.ghlTags ?? []).map((t) => t.id));
    setGhlFormChoiceIds((existing?.ghlForms ?? []).map((f) => f.id));
    setWebhookChoiceIds((existing?.webhooks ?? []).map((w) => w.id));
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
      // GHL Tags / GHL Forms are only sent on GHL pages (where the pickers show).
      // Omitting them on non-GHL platforms means the API leaves those columns
      // untouched rather than wiping them.
      const ghlFields = {
        ...(showGhlTags ? { ghlTagChoiceIds } : {}),
        ...(showGhlForms ? { ghlFormChoiceIds } : {}),
      };
      const body = isEdit
        ? { name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, automationTagChoiceIds, webhookChoiceIds, ...ghlFields }
        : { platform, name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, automationTagChoiceIds, webhookChoiceIds, ...ghlFields };

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
        // GHL Tags + GHL Forms: resolve the selected ids to their choices so the
        // row's plain-text cells render immediately (no colours here). Alphabetical
        // by value to match the loader. Empty on non-GHL platforms.
        ghlTags: ghlTagChoiceIds
          .map((tid) => ghlTagChoices.find((c) => c.id === tid))
          .filter((c): c is ChoiceOption => !!c)
          .map((c) => ({
            id: c.id,
            value: c.value,
            badgeColor: c.badgeColor,
            textColor: c.textColor,
          }))
          .sort((a, b) => a.value.localeCompare(b.value)),
        ghlForms: ghlFormChoiceIds
          .map((fid) => ghlFormChoices.find((c) => c.id === fid))
          .filter((c): c is ChoiceOption => !!c)
          .map((c) => ({
            id: c.id,
            value: c.value,
            badgeColor: c.badgeColor,
            textColor: c.textColor,
          }))
          .sort((a, b) => a.value.localeCompare(b.value)),
        // Webhook Links: resolve the selected ids to their {id, url} from the
        // loaded webhook choices, so the cell renders immediately. Alphabetical
        // by url to match the loader's ordering.
        webhooks: webhookChoiceIds
          .map((wid) => webhookChoices.find((c) => c.id === wid))
          .filter((c): c is ChoiceOption => !!c)
          .map((c) => ({ id: c.id, url: c.value }))
          .sort((a, b) => a.url.localeCompare(b.url)),
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
              className="border-zinc-300 shadow-sm block min-h-9 resize-none overflow-hidden [overflow-wrap:anywhere]"
            />
            <p className="text-[10px] text-zinc-500">
              The exact name of the automation as seen from its home website.
            </p>
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
              className="border-zinc-300 shadow-sm"
            />
            <p className="text-[10px] text-zinc-500">
              The link that leads directly to the editor view of the automation.
            </p>
          </div>
          {/* The four dropdowns in a 2-col grid: Status | Author (row 1),
              Automation Tags | Trigger Event (row 2). Left-column fields (Status,
              Automation Tags) open their menus to the LEFT; right-column (Author,
              Trigger Event) to the RIGHT — menus open outward from the dialog.
              items-start so a taller field (e.g. Tags with many chips) doesn't
              stretch its row-mate. */}
          <div className="grid grid-cols-2 items-start gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wf-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? "paused")}
              open={statusOpen}
              onOpenChange={(o) => setStatusOpen(o)}
            >
              {/* Trigger + list items render the value as COLOURED TEXT (green
                  Active / neutral Paused), mirroring the GHL Forms Status
                  dropdown. SelectValue's function child formats the closed
                  trigger; status always has a value ("paused" default), so the
                  fallback is just defensive. */}
              {/* Clearer field look (matches the other Add/Edit fields): zinc-300
                  resting border + shadow-sm. Keeps the shared SelectTrigger's
                  built-in focus ring AND shows it while the menu is open
                  (data-popup-open), so a click activates the ring like the other
                  dropdowns. Per-instance override so selects elsewhere are
                  unaffected. */}
              <SelectTrigger
                ref={statusTriggerRef}
                id="wf-status"
                className="w-full border-zinc-300 shadow-sm data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50"
              >
                <SelectValue placeholder="Status">
                  {(v) => {
                    const o = WF_STATUS_OPTIONS.find((x) => x.value === v);
                    return <span className={o?.text}>{o?.label ?? "Paused"}</span>;
                  }}
                </SelectValue>
              </SelectTrigger>
              {/* Standard dropdown behaviour (via usePopoverSide): Status opens
                  LEFT pinned (outward from the dialog), or vertically when that
                  side is too narrow. alignItemWithTrigger={false} is required for
                  `side` to take effect on a Base UI Select (its default native-like
                  item-over-trigger alignment ignores side). w-44 pins the popup to
                  the GHL Forms Status dropdown's width (the reference), instead of
                  matching the full-width trigger. */}
              <SelectContent
                side={statusSide}
                align="start"
                sideOffset={8}
                alignItemWithTrigger={false}
                collisionAvoidance={statusCollisionAvoidance}
                className="w-44"
              >
                {WF_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className={o.text}>
                    {o.label}
                  </SelectItem>
                ))}
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
              side="right"
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
              side="left"
            />
            <p className="text-[10px] text-zinc-500">
              Short labels regarding the automation&apos;s scope.
            </p>
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
              side="right"
            />
            <p className="text-[10px] text-zinc-500">
              This is how the automation is activated.
            </p>
          </div>
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
              className="border-zinc-300 shadow-sm block resize-none overflow-hidden [overflow-wrap:anywhere]"
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
              className="border-zinc-300 shadow-sm block resize-none overflow-hidden [overflow-wrap:anywhere]"
            />
          </div>
          {/* GHL Tags + GHL Forms: full-width fields, shown only on the GHL pages
              (same gate as the table columns). Sit between Notes and Webhook Links
              to match the table column order (user-set 2026-07-31). Full width
              (not the old cramped 2-col grid row) so the many selected values have
              room. Multi-select; plain options (no colours). */}
          {showGhlTags && (
            <div className="space-y-1.5">
              <Label htmlFor="wf-ghl-tags">GHL Tags</Label>
              <MultiChoiceCombobox
                id="wf-ghl-tags"
                options={ghlTagChoices}
                values={ghlTagChoiceIds}
                onChange={(v) => {
                  setGhlTagChoiceIds(v);
                  setError(null);
                }}
                searchPlaceholder="Search GHL tags…"
                emptyLabel="None"
                noResultsLabel="No GHL tags found."
                side="right"
              />
            </div>
          )}
          {showGhlForms && (
            <div className="space-y-1.5">
              <Label htmlFor="wf-ghl-forms">GHL Forms</Label>
              <MultiChoiceCombobox
                id="wf-ghl-forms"
                options={ghlFormChoices}
                values={ghlFormChoiceIds}
                onChange={(v) => {
                  setGhlFormChoiceIds(v);
                  setError(null);
                }}
                searchPlaceholder="Search GHL forms…"
                emptyLabel="None"
                noResultsLabel="No GHL forms found."
                side="right"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="wf-webhook-links">Webhook Links</Label>
            {/* Multi-select: pick ANY number of Webhook Links from the configured
                choices (managed on the Dropdown Configuration page). Optional; the
                trigger shows the selected URLs as chips, red "None" when empty.
                Sits after Notes, matching the table column order. */}
            <MultiChoiceCombobox
              id="wf-webhook-links"
              options={webhookChoices}
              values={webhookChoiceIds}
              onChange={(v) => {
                setWebhookChoiceIds(v);
                setError(null);
              }}
              searchPlaceholder="Search webhooks…"
              emptyLabel="None"
              noResultsLabel="No webhooks found."
              side="right"
            />
            <p className="text-[10px] text-zinc-500">
              These are links used by Webhook nodes in the automation.
            </p>
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          </div>
          <DialogFooter className="shrink-0">
            {/* Delete (edit mode only). Same trash icon the removed per-row
                Actions column used, but RED at rest instead of gray-until-hover.
                sm:mr-auto pushes it to the footer's left edge, leaving Cancel +
                Save changes right-aligned. type="button" so it never submits the
                form; the confirm + request live in the caller's handleDelete. */}
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={submitting}
                aria-label="Delete this automation"
                className="inline-flex items-center self-center rounded-md p-1 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50 sm:mr-auto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
              {isEdit ? "Save changes" : "Add Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

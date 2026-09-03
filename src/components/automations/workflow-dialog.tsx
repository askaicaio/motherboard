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
//
// THREE of the pickers here can CREATE their own options without leaving this
// dialog (GHL Tags, GHL Forms, Webhook Links), added 2026-09-03. See the
// "New option" block below the status constants for the scope rule, the
// per-table differences and why the second dialog is a sibling rather than a
// child of the picker's popover.
//
// ⚠️ BOTH CALLERS GET THAT BUTTON, and that was the explicit decision, not an
// oversight: this component is rendered by the Per Website table
// (`automations-table-client.tsx`) AND by View All Lists
// (`all-automations-table-client.tsx`). The user was asked under the
// ASK-BEFORE-SYNC rule and chose both pages, so the button is unconditional
// here rather than gated on a caller prop. Note View All Lists deliberately
// cannot create AUTOMATIONS; creating a dropdown OPTION there is a different
// thing and is allowed.

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { SingleChoiceCombobox } from "./single-choice-combobox";
import { MultiChoiceCombobox } from "./multi-choice-combobox";
import {
  usePopoverSide,
  NARROW_SIDE_SPACE_SELECT_PX,
} from "./use-popover-side";
import {
  columnVisibleOnPlatform,
  DEFAULT_STATUS,
  DROPDOWN_COLUMNS,
  WEBHOOK_CHOICE_META,
  WEBHOOK_SCOPE,
  selectableStatusOptions,
} from "@/lib/automations/dropdown-config";
import type {
  ChoiceOption,
  StatusOption,
} from "@/lib/automations/dropdown-config";
import { ChoiceDialog, type ChoiceSubmit } from "./choice-dialog";
import { useRouter } from "next/navigation";

/** Status options rendered as COLOURED TEXT in the Status dropdown, mirroring
 *  the GHL Forms Status dropdown (green Active, neutral-gray Paused). Replaces
 *  the earlier filled pill, which read as cramped in the side-opening popup. */
const WF_STATUS_OPTIONS = [
  { value: "active", label: "Active", text: "text-emerald-700" },
  { value: "paused", label: "Paused", text: "text-zinc-700" },
];

// ---------------------------------------------------------------------------
// "New option" from inside the dropdowns
// ---------------------------------------------------------------------------
// User, 2026-09-03: a button in the GHL Tags, GHL Forms and Webhook Links
// pickers, to the right of their search bar, so an admin can add a missing
// Dropdown Config option WITHOUT abandoning the workflow they are part-way
// through filling in. The picker draws the button (MultiChoiceCombobox's
// `onAddOption`); everything below is what happens when it is pressed.
//
// ⚠️ SCOPE IS THESE THREE, because these three were asked for. Author, Trigger
// Event, Evaluation and Automation Tags use the same pickers and deliberately do
// NOT get the button. Do not fan it out without being asked. (The ask itself
// grew from two to three mid-session, so a fourth would arrive the same way.)
//
// ⚠️ THE THREE TARGETS ARE NOT THE SAME KIND OF TABLE. GHL Tags and GHL Forms
// are ordinary `DropdownColumnKey` columns: one shared `automation_dropdown_choices`
// table, POST /api/automations/dropdown-choices with a `columnKey`. Webhook
// Links has its OWN table and its OWN route, POST
// /api/automations/webhook-choices, and takes `url` rather than `value`. The
// AddTarget shape below flattens that so the dialog and the request do not each
// need a special case.
type AddKind = "ghl_tags" | "ghl_forms" | typeof WEBHOOK_SCOPE;

interface AddTarget {
  /** Table name, for the dialog's heading and description. */
  title: string;
  /** Reads inside a sentence: "Add a new GHL tag". */
  singular: string;
  fieldLabel: string;
  placeholder: string;
  isUrl: boolean;
  hasStatus: boolean;
  statusOptions: StatusOption[];
  defaultStatus: string;
  hasNotes: boolean;
}

/** An AddTarget for one of the two ordinary choice columns, read from
 *  DROPDOWN_COLUMNS so the wording matches the Dropdown Config page's own
 *  dialog exactly. Falls back rather than asserting: a missing key would be a
 *  programming error, and a dialog labelled "option" beats a crash. */
function choiceColumnTarget(key: "ghl_tags" | "ghl_forms"): AddTarget {
  const col = DROPDOWN_COLUMNS.find((c) => c.key === key);
  return {
    title: col?.title ?? "Options",
    singular: col?.singular ?? "option",
    fieldLabel: col?.fieldLabel ?? "Value",
    placeholder: col?.placeholder ?? "",
    isUrl: false,
    hasStatus: !!col?.hasStatus,
    // The admin-only status is stripped, exactly as the Dropdown Config page
    // strips it: this dialog only ever ADDS an ordinary option.
    statusOptions: selectableStatusOptions(col?.statusOptions ?? []),
    defaultStatus: col?.defaultStatus ?? DEFAULT_STATUS,
    hasNotes: !!col?.hasNotes,
  };
}

const ADD_TARGETS: Record<AddKind, AddTarget> = {
  ghl_tags: choiceColumnTarget("ghl_tags"),
  ghl_forms: choiceColumnTarget("ghl_forms"),
  // Webhook Links' facts come from the lib too (WEBHOOK_CHOICE_META), for the
  // same reason: one copy, shared with the Dropdown Config page. It carries no
  // Status column.
  [WEBHOOK_SCOPE]: {
    ...WEBHOOK_CHOICE_META,
    hasStatus: false,
    statusOptions: [],
    defaultStatus: "",
  },
};

/** The caller's options plus any created in this dialog that the server has not
 *  sent back yet, deduplicated by id.
 *  ⚠️ IT APPENDS, IT DOES NOT RE-SORT. The incoming order is the server's
 *  (alphabetical, built-in options floated to the top by `sortSpecialFirst`),
 *  and re-sorting client-side would visibly reshuffle the whole list around one
 *  new row. A new option is auto-selected anyway, so it shows in the picker's
 *  pinned selected block at the top regardless of where it sits in the list
 *  below; `router.refresh()` then puts it in its proper place. */
function mergeExtras(base: ChoiceOption[], extra?: ChoiceOption[]): ChoiceOption[] {
  if (!extra || extra.length === 0) return base;
  const known = new Set(base.map((o) => o.id));
  const missing = extra.filter((o) => !known.has(o.id));
  return missing.length === 0 ? base : [...base, ...missing];
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
  /** Configured Triage options for the single-select Triage dropdown. */
  triageChoices?: ChoiceOption[];

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
  triageChoices = [],

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
  // Triage: the selected Triage choice id ("" = not yet triaged, which is
  // DISTINCT from the "Unknown" choice — see the AutomationRow comment).
  const [triageChoiceId, setTriageChoiceId] = useState("");

  // Automation Tags: the selected tag choice ids (multi-select). Empty = none.
  const [automationTagChoiceIds, setAutomationTagChoiceIds] = useState<string[]>([]);
  // GHL Tags + GHL Forms: selected choice ids (multi-select, GHL pages only).
  const [ghlTagChoiceIds, setGhlTagChoiceIds] = useState<string[]>([]);
  const [ghlFormChoiceIds, setGhlFormChoiceIds] = useState<string[]>([]);
  // Webhook Links: the selected webhook choice ids (multi-select). Empty = none.
  const [webhookChoiceIds, setWebhookChoiceIds] = useState<string[]>([]);
  // Inline error shown as red text inside the dialog (e.g. duplicate link).
  const [error, setError] = useState<string | null>(null);
  // Which picker's "New option" button was pressed, i.e. which table the
  // stacked ChoiceDialog is adding to. null = that dialog is closed.
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  // Options created from inside this dialog, per table, so they appear in the
  // picker IMMEDIATELY. `router.refresh()` also runs, and once its new props
  // arrive `mergeExtras` drops these as duplicates by id.
  // ⚠️ DELIBERATELY NOT RESET when the dialog reopens, unlike every field
  // below. If it were, closing and reopening the workflow before the refresh
  // landed would make a just-created option VANISH from the picker until a full
  // page load. Costs nothing to keep: they are deduplicated on every render.
  const [extraOptions, setExtraOptions] = useState<
    Partial<Record<AddKind, ChoiceOption[]>>
  >({});
  const router = useRouter();
  // GHL Tags + GHL Forms are GHL-only fields, shown only when this automation's
  // platform is a GoHighLevel page (same gate as the table columns).
  const showGhlTags = columnVisibleOnPlatform("ghl_tags", platform);
  const showGhlForms = columnVisibleOnPlatform("ghl_forms", platform);
  // What the three pickers actually render: the caller's server-loaded options
  // plus anything created here that the server has not sent back yet.
  const ghlTagOptions = mergeExtras(ghlTagChoices, extraOptions.ghl_tags);
  const ghlFormOptions = mergeExtras(ghlFormChoices, extraOptions.ghl_forms);
  const webhookOptions = mergeExtras(
    webhookChoices,
    extraOptions[WEBHOOK_SCOPE],
  );

  /** Creates one Dropdown Config option from inside this dialog, then SELECTS
   *  it on the workflow being edited. Returns null on success, or the message
   *  ChoiceDialog should show. (ChoiceDialog closes itself on null.)
   *
   *  AUTO-SELECT IS THE USER'S CHOICE, 2026-09-03: they are creating the option
   *  because this workflow needs it, so ticking it for them saves a click and
   *  removes the chance of creating it and forgetting to apply it. */
  async function createOption(
    kind: AddKind,
    payload: ChoiceSubmit,
  ): Promise<string | null> {
    const target = ADD_TARGETS[kind];
    const isWebhook = kind === WEBHOOK_SCOPE;
    // Webhook Links takes `url` on its own route; the two choice columns take
    // `value` + `columnKey` on the shared one. Status / Notes are sent only
    // where the table has them, matching the Dropdown Config page's own body.
    const res = await fetch(
      isWebhook
        ? "/api/automations/webhook-choices"
        : "/api/automations/dropdown-choices",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isWebhook
            ? {
                url: payload.value,
                ...(target.hasNotes ? { notes: payload.notes ?? "" } : {}),
              }
            : {
                columnKey: kind,
                value: payload.value,
                ...(target.hasStatus ? { status: payload.status } : {}),
                ...(target.hasNotes ? { notes: payload.notes ?? "" } : {}),
              },
        ),
      },
    );
    let data: {
      error?: string;
      choice?: { id: string };
      webhook?: { id: string };
    } = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    // The duplicate-value message comes back from the API, so "that option
    // already exists" reads the same here as on the Dropdown Config page.
    if (!res.ok) return data.error || `Save failed (${res.status})`;
    const saved = isWebhook ? data.webhook : data.choice;
    if (!saved) return "Save failed";

    // Colours are null because neither of these three tables carries any
    // (hasColor is Trigger Event / Author only), which is also why the dialog
    // above shows no swatch pickers.
    const option: ChoiceOption = {
      id: saved.id,
      value: payload.value,
      badgeColor: null,
      textColor: null,
    };
    setExtraOptions((prev) => ({
      ...prev,
      [kind]: [...(prev[kind] ?? []), option],
    }));
    if (kind === "ghl_tags") setGhlTagChoiceIds((v) => [...v, option.id]);
    else if (kind === "ghl_forms") setGhlFormChoiceIds((v) => [...v, option.id]);
    else setWebhookChoiceIds((v) => [...v, option.id]);
    // Clear any stale form error: the dialog is usable again.
    setError(null);
    toast.success(`Added to ${target.title}`);
    // So the rest of the page agrees: the table's own cells, its filters, and
    // the Dropdown Config page all read these options from the server.
    router.refresh();
    return null;
  }
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
    setTriageChoiceId(existing?.triageChoiceId ?? "");

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
      const triagePayload = triageChoiceId || null;

      // GHL Tags / GHL Forms are only sent on GHL pages (where the pickers show).
      // Omitting them on non-GHL platforms means the API leaves those columns
      // untouched rather than wiping them.
      const ghlFields = {
        ...(showGhlTags ? { ghlTagChoiceIds } : {}),
        ...(showGhlForms ? { ghlFormChoiceIds } : {}),
      };
      const body = isEdit
        ? { name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, triageChoiceId: triagePayload, automationTagChoiceIds, webhookChoiceIds, ...ghlFields }
        : { platform, name: name.trim(), externalUrl: externalUrl.trim(), status, purpose: purpose.trim(), notes: notes.trim(), authorChoiceId: authorPayload, triggerEventChoiceId: triggerEventPayload, triageChoiceId: triagePayload, automationTagChoiceIds, webhookChoiceIds, ...ghlFields };


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
      // Triage: resolve the chosen option (value + colours) the same way.
      const savedTriage = triageChoices.find(
        (c) => c.id === saved.triageChoiceId,
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
        triageChoiceId: saved.triageChoiceId ?? null,
        triage: savedTriage?.value ?? null,
        triageBadgeColor: savedTriage?.badgeColor ?? null,
        triageTextColor: savedTriage?.textColor ?? null,

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
        // ⚠️⚠️ THESE THREE RESOLVE AGAINST THE **MERGED** LISTS
        // (ghlTagOptions / ghlFormOptions / webhookOptions), NOT the raw props.
        // An option created by this dialog's own "New option" button exists ONLY
        // in `extraOptions` until `router.refresh()` lands, and the
        // `.filter(c => !!c)` below SILENTLY DROPS anything it cannot resolve.
        // Against the raw props a just-created option would therefore save
        // correctly to the database and then be MISSING from the table cell
        // until a reload, and only SOMETIMES, depending on whether the refresh
        // beat the save. (Automation Tags keeps the raw prop: it has no add
        // button, so it can never have extras.)
        ghlTags: ghlTagChoiceIds
          .map((tid) => ghlTagOptions.find((c) => c.id === tid))
          .filter((c): c is ChoiceOption => !!c)
          .map((c) => ({
            id: c.id,
            value: c.value,
            badgeColor: c.badgeColor,
            textColor: c.textColor,
          }))
          .sort((a, b) => a.value.localeCompare(b.value)),
        ghlForms: ghlFormChoiceIds
          .map((fid) => ghlFormOptions.find((c) => c.id === fid))
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
          .map((wid) => webhookOptions.find((c) => c.id === wid))
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
    // Its own TooltipProvider: this dialog is opened from BOTH table clients,
    // and in each one the existing provider wraps only the <Card>, not the
    // dialog. Owning one keeps the delete button's tooltip working wherever the
    // dialog is mounted, rather than depending on the caller.
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
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
          <div className="space-y-1.5">
            <Label htmlFor="wf-triage">Evaluation</Label>
            {/* Single-select: what should HAPPEN to this automation. Optional;
                the "None" row clears it back to NOT YET TRIAGED, which is a
                different thing from the "Unknown" choice.
                Opens LEFT: this is a LEFT-column field (the grid runs
                Status/Author, Automation Tags/Trigger Event, then Evaluation),
                and docs/dropdown-menu-standard.md sets side by column. Do NOT
                copy the side="right" from Trigger Event above — that one sits in
                the RIGHT column, and copying it made this popup cover Purpose
                and Notes. */}
            <SingleChoiceCombobox
              id="wf-triage"
              options={triageChoices}
              value={triageChoiceId}
              onChange={(v) => {
                setTriageChoiceId(v);
                setError(null);
              }}
              searchPlaceholder="Search evaluations…"
              emptyLabel="None"
              noResultsLabel="No evaluations found."
              side="left"
            />
            <p className="text-[10px] text-zinc-500">
              What should happen to this automation.
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
                options={ghlTagOptions}
                values={ghlTagChoiceIds}
                onChange={(v) => {
                  setGhlTagChoiceIds(v);
                  setError(null);
                }}
                searchPlaceholder="Search GHL tags…"
                emptyLabel="None"
                noResultsLabel="No GHL tags found."
                side="right"
                // One of the THREE pickers that can create their own options
                // (see the AddKind block at the top of this file). The label is
                // deliberately short: it shares a width-capped row with the
                // search box.
                onAddOption={() => setAddKind("ghl_tags")}
                addOptionLabel="New tag"
              />
            </div>
          )}
          {showGhlForms && (
            <div className="space-y-1.5">
              <Label htmlFor="wf-ghl-forms">GHL Forms</Label>
              <MultiChoiceCombobox
                id="wf-ghl-forms"
                options={ghlFormOptions}
                values={ghlFormChoiceIds}
                onChange={(v) => {
                  setGhlFormChoiceIds(v);
                  setError(null);
                }}
                searchPlaceholder="Search GHL forms…"
                emptyLabel="None"
                noResultsLabel="No GHL forms found."
                side="right"
                onAddOption={() => setAddKind("ghl_forms")}
                addOptionLabel="New form"
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
              options={webhookOptions}
              values={webhookChoiceIds}
              onChange={(v) => {
                setWebhookChoiceIds(v);
                setError(null);
              }}
              searchPlaceholder="Search webhooks…"
              emptyLabel="None"
              noResultsLabel="No webhooks found."
              side="right"
              onAddOption={() => setAddKind(WEBHOOK_SCOPE)}
              addOptionLabel="New link"
              // Webhook URLs truncate (intended: they are far wider than the
              // popover cap), but the truncated head is not enough to tell one
              // link from another, so hovering a row reveals the whole thing.
              // ONLY here: the tag/form pickers show short values whose visible
              // text is already the whole meaning.
              showFullValueOnHover
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
                size-8 matches the h-8 of the Cancel / Save changes buttons beside
                it, so all three footer controls are the same height (the icon
                itself stays 16px). sm:mr-auto pushes it to the footer's left edge,
                leaving Cancel + Save changes right-aligned. type="button" so it
                never submits the form; the confirm + request live in the caller's
                handleDelete. */}
            {isEdit && onDelete && (
              // Icon-only, and the most destructive control in the dialog, so it
              // had nothing a sighted user could read. The tooltip also says the
              // part that decides whether you press it: a synced website will
              // put the row back, everything typed here will not come back.
              <Tooltip disableHoverablePopup>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={submitting}
                      aria-label="Delete this automation"
                      className="inline-flex size-8 shrink-0 items-center justify-center self-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50 sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
                <TooltipContent className="max-w-xs">
                  Removes this row from the Motherboard app. A later Refresh List
                  can add the row back.
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
              {isEdit ? "Save changes" : "Add Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {/* ⭐ THE "New option" DIALOG, stacked ON TOP of this one, 2026-09-03.
        Reuses the Dropdown Configuration page's own ChoiceDialog in its ADD
        mode (`initialValue=""`, no `onDelete`), so the fields, the validation
        and the wording are the page's, not a second implementation.

        ⚠️ IT IS A SIBLING OF <Dialog>, NOT A CHILD OF THE PICKER'S POPOVER.
        Nesting it inside the popover would tie its lifetime to a popover that
        closes the moment focus moves into the new dialog. As a sibling it
        portals to the body and stacks above, which is the same shape
        `confirmDialog` already uses over this dialog's Delete button, so
        dialog-over-dialog is a proven pattern here rather than a new one.

        ⚠️ RENDERED ONLY WHILE `addKind` IS SET, and keyed by it. ChoiceDialog
        seeds its fields from props in an `open`-gated effect, so a fresh mount
        per table is what guarantees no value, status or note leaks from the
        last table's add into the next one's. */}
    {addKind && (
      <ChoiceDialog
        key={addKind}
        open
        onOpenChange={(o) => {
          if (!o) setAddKind(null);
        }}
        heading={`Add ${ADD_TARGETS[addKind].singular}`}
        description={`Add a new option to ${ADD_TARGETS[addKind].title}. It will be selected on this workflow.`}
        fieldLabel={ADD_TARGETS[addKind].fieldLabel}
        placeholder={ADD_TARGETS[addKind].placeholder}
        isUrl={ADD_TARGETS[addKind].isUrl}
        initialValue=""
        submitLabel="Add option"
        showStatus={ADD_TARGETS[addKind].hasStatus}
        statusOptions={ADD_TARGETS[addKind].statusOptions}
        initialStatus={ADD_TARGETS[addKind].defaultStatus}
        showNotes={ADD_TARGETS[addKind].hasNotes}
        initialNotes=""
        onSubmit={(payload) => createOption(addKind, payload)}
      />
    )}
    </TooltipProvider>
  );
}

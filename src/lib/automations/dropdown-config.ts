// Shared config + row types for the Automations "Dropdown Configuration" page.
//
// PURE MODULE (no `db` import) so both the server page and the "use client"
// config component can import it. The actual DB reads happen inline in the
// server page (mirrors how the Automations Main Page reads its data).
//
// The four "generic" text columns live in the `automation_dropdown_choices`
// table keyed by `column_key`; Webhook Links has its own table
// (`automation_webhook_choices`) because it grows a relationships/junction
// later. Single-vs-multi-select for how automations reference these choices is
// still TBD and does NOT affect these option lists.

export type DropdownColumnKey =
  | "author"
  | "automation_tags"
  | "ghl_tags"
  | "trigger_event";

/** Fixed status options for the GHL Tags column (not user-managed). New GHL Tag
 *  entries default to DEFAULT_GHL_TAG_STATUS. */
export const GHL_TAG_STATUSES = [
  "Keep",
  "To Remove",
  "Unknown",
  "Removed",
] as const;
export type GhlTagStatus = (typeof GHL_TAG_STATUSES)[number];
export const DEFAULT_GHL_TAG_STATUS: GhlTagStatus = "Unknown";

export interface DropdownColumnConfig {
  /** Stored in `automation_dropdown_choices.column_key`. */
  key: DropdownColumnKey;
  /** Table heading (matches the eventual Per Website column name). */
  title: string;
  /** Label + heading noun used in the Add/Edit dialog (e.g. "Add author"). */
  singular: string;
  /** The dialog field label. */
  fieldLabel: string;
  /** Input + search placeholder example. */
  placeholder: string;
  /** True → the column only applies to the GHL pages. Metadata for the future
   *  GHL-gated column (no visible tag on the Config page). */
  ghlOnly?: boolean;
  /** True → rows carry a Status (fixed GHL_TAG_STATUSES dropdown). GHL Tags only. */
  hasStatus?: boolean;
  /** True → rows carry a free-text Notes field (Purpose-style). GHL Tags only. */
  hasNotes?: boolean;
}

// Order here is the top-to-bottom order the tables render on the Config page.
export const DROPDOWN_COLUMNS: DropdownColumnConfig[] = [
  {
    key: "author",
    title: "Author",
    singular: "author",
    fieldLabel: "Author",
    placeholder: "e.g. Jane Doe",
  },
  {
    key: "automation_tags",
    title: "Automation Tags",
    singular: "tag",
    fieldLabel: "Tag",
    placeholder: "e.g. Lead capture",
  },
  {
    key: "ghl_tags",
    title: "GHL Tags",
    singular: "GHL tag",
    fieldLabel: "GHL tag",
    placeholder: "e.g. Nurture sequence",
    ghlOnly: true,
    hasStatus: true,
    hasNotes: true,
  },
  {
    key: "trigger_event",
    title: "Trigger Event",
    singular: "trigger event",
    fieldLabel: "Trigger event",
    placeholder: "e.g. Form submitted",
  },
];

/** A single option row for one of the four generic dropdown columns. */
export interface DropdownChoiceRow {
  id: string;
  columnKey: DropdownColumnKey;
  value: string;
  /** GHL Tags only: one of GHL_TAG_STATUSES. Null/undefined for other columns. */
  status?: string | null;
  /** GHL Tags only: free-text note. Null/undefined for other columns. */
  notes?: string | null;
}

/** A single webhook URL choice. */
export interface WebhookChoiceRow {
  id: string;
  url: string;
}

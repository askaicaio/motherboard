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
  | "ghl_forms"
  | "trigger_event";

/** One status option: its label plus display tones. `badge` = pill bg + text for
 *  the table's Status column; `text` = text-only colour for the option + selected
 *  value in the Add/Edit dialog dropdown. Single source of truth so a column's
 *  table and dialog stay in sync. Status sets are PER COLUMN (see each column's
 *  `statusOptions` below), so different columns can offer different statuses. */
export interface StatusOption {
  value: string;
  badge: string;
  text: string;
}

/** Default status for a new entry in any status-bearing column. Every status set
 *  below includes it. */
export const DEFAULT_STATUS = "Unknown";

/** Status set for the GHL Tags + GHL Forms columns (user-set 2026-07-24): Keep =
 *  green, To Remove = red, Unknown = black, Removed = yellow. Order here is the
 *  top-to-bottom group order in those tables. */
export const GHL_TAG_STATUS_OPTIONS: StatusOption[] = [
  { value: "Keep", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  { value: "To Remove", badge: "bg-red-100 text-red-700", text: "text-red-700" },
  { value: "Unknown", badge: "bg-zinc-100 text-zinc-900", text: "text-zinc-900" },
  { value: "Removed", badge: "bg-yellow-100 text-yellow-800", text: "text-yellow-700" },
];

/** Status set for the Author column (user-set 2026-07-25): Active = green,
 *  Inactive = red, Unknown = black. */
export const AUTHOR_STATUS_OPTIONS: StatusOption[] = [
  { value: "Active", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  { value: "Inactive", badge: "bg-red-100 text-red-700", text: "text-red-700" },
  { value: "Unknown", badge: "bg-zinc-100 text-zinc-900", text: "text-zinc-900" },
];

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
  /** True → rows carry a Status. When set, `statusOptions` lists the choices and
   *  `defaultStatus` is used for a new entry. GHL Tags, GHL Forms, Author. */
  hasStatus?: boolean;
  /** This column's Status choices (present iff hasStatus). PER COLUMN: GHL Tags +
   *  GHL Forms use GHL_TAG_STATUS_OPTIONS; Author uses AUTHOR_STATUS_OPTIONS. */
  statusOptions?: StatusOption[];
  /** Default status for a new entry (present iff hasStatus). */
  defaultStatus?: string;
  /** True → the Config table GROUPS rows by status order (then alphabetizes
   *  within a group), like GHL Tags + GHL Forms. Omit → plain alphabetical order
   *  (Author). */
  statusGrouped?: boolean;
  /** True → rows carry a free-text Notes field (Purpose-style). GHL Tags, GHL
   *  Forms, Author. */
  hasNotes?: boolean;
  /** Header for the FIRST column in the rich (Status/Notes) table view, e.g.
   *  "Tag" for GHL Tags, "Form" for GHL Forms, "Author" for Author. Only used by
   *  the rich tables. */
  rowLabel?: string;
}

// Order here is the top-to-bottom order the tables render on the Config page.
export const DROPDOWN_COLUMNS: DropdownColumnConfig[] = [
  {
    // Author / Status / Notes table. Rich (hasStatus + hasNotes) like GHL Tags,
    // but with its OWN status set (Active/Inactive/Unknown) and NOT status-grouped
    // (kept plain alphabetical by author name, per user 2026-07-25).
    key: "author",
    title: "Author",
    singular: "author",
    fieldLabel: "Author",
    placeholder: "e.g. Jane Doe",
    rowLabel: "Author",
    hasStatus: true,
    statusOptions: AUTHOR_STATUS_OPTIONS,
    defaultStatus: DEFAULT_STATUS,
    hasNotes: true,
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
    statusOptions: GHL_TAG_STATUS_OPTIONS,
    defaultStatus: DEFAULT_STATUS,
    statusGrouped: true,
    hasNotes: true,
    rowLabel: "Tag",
  },
  {
    // Form / Status / Notes table mirroring GHL Tags (hasStatus + hasNotes); the
    // first column header reads "Form". Tab sits between GHL Tags and Trigger
    // Event (order here drives the Config page toolbar tab order). No `ghlOnly`
    // flag: platform-gating of the FUTURE Per Website column is still TBD.
    key: "ghl_forms",
    title: "GHL Forms",
    singular: "GHL form",
    fieldLabel: "GHL form",
    placeholder: "e.g. Contact form",
    rowLabel: "Form",
    hasStatus: true,
    statusOptions: GHL_TAG_STATUS_OPTIONS,
    defaultStatus: DEFAULT_STATUS,
    statusGrouped: true,
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
  /** Status-bearing columns only (GHL Tags, GHL Forms, Author): one of that
   *  column's `statusOptions` values. Null/undefined for the plain columns. */
  status?: string | null;
  /** Notes-bearing columns only (GHL Tags, GHL Forms, Author): free-text note.
   *  Null/undefined for the plain columns. */
  notes?: string | null;
}

/** A single webhook URL choice. */
export interface WebhookChoiceRow {
  id: string;
  url: string;
}

/** One selectable option handed to a Per Website dropdown column's picker
 *  (the searchable dropdown in the Add/Edit Workflow dialog). `id` is the
 *  `automation_dropdown_choices` row id stored on the automation; `value` is
 *  the label shown. Shared by every dropdown-driven column. */
export interface ChoiceOption {
  id: string;
  value: string;
}

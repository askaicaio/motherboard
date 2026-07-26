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

/** One selectable colour swatch for the colour-driven columns (Trigger Event).
 *  `key` is stored on the choice (in `badge_color` / `text_color`); `hex` is the
 *  actual colour rendered (inline style, so it's independent of the app's pale
 *  pill classes); `label` is shown next to the swatch. Vibrant set + neutrals,
 *  user-approved 2026-07-25. Used for BOTH the pill (badge) colour and the text
 *  colour, chosen independently per choice. */
export interface ChoiceColor {
  key: string;
  label: string;
  hex: string;
}

export const CHOICE_COLOR_OPTIONS: ChoiceColor[] = [
  { key: "teal", label: "Teal", hex: "#14b8a6" },
  { key: "green", label: "Green", hex: "#22c55e" },
  { key: "mint", label: "Mint", hex: "#6ee7b7" },
  { key: "cyan", label: "Cyan", hex: "#06b6d4" },
  { key: "blue", label: "Blue", hex: "#3b82f6" },
  { key: "indigo", label: "Indigo", hex: "#6366f1" },
  { key: "lavender", label: "Lavender", hex: "#c4b5fd" },
  { key: "purple", label: "Purple", hex: "#8b5cf6" },
  { key: "pink", label: "Pink", hex: "#ec4899" },
  { key: "rose", label: "Rose", hex: "#f43f5e" },
  { key: "red", label: "Red", hex: "#ef4444" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "gold", label: "Gold", hex: "#f59e0b" },
  { key: "yellow", label: "Yellow", hex: "#facc15" },
  { key: "brown", label: "Brown", hex: "#92400e" },
  { key: "white", label: "White", hex: "#ffffff" },
  { key: "gray", label: "Gray", hex: "#6b7280" },
  { key: "black", label: "Black", hex: "#111827" },
];

/** Look up a colour's hex by key (undefined for an unknown/unset key). */
export function choiceColorHex(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return CHOICE_COLOR_OPTIONS.find((c) => c.key === key)?.hex;
}

/** Label for a colour key (or "" when unset/unknown). */
export function choiceColorLabel(key: string | null | undefined): string {
  if (!key) return "";
  return CHOICE_COLOR_OPTIONS.find((c) => c.key === key)?.label ?? "";
}

/** Set of valid colour keys, for API validation. */
export const CHOICE_COLOR_KEYS = CHOICE_COLOR_OPTIONS.map((c) => c.key);

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
  /** True → rows carry a Badge Color + Text Color (chosen independently from
   *  CHOICE_COLOR_OPTIONS), and the value renders as a coloured pill preview.
   *  Trigger Event. Renders as a rich table (like hasStatus/hasNotes do). */
  hasColor?: boolean;
  /** Header for the FIRST column in the rich (Status/Notes/Color) table view,
   *  e.g. "Tag" for GHL Tags, "Form" for GHL Forms, "Author" for Author,
   *  "Trigger Event" for Trigger Event. Only used by the rich tables. */
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
    // Trigger Event / Badge Color / Text Color / Notes table. `hasColor` makes
    // it a rich table: the value renders as a coloured pill (badge + text colours
    // chosen independently in the Add/Edit dialog), plus two colour columns.
    // `hasNotes` adds a Purpose-style Notes column (mimics the Author table),
    // rendered last (4th column); reuses the shared `notes` field (migration
    // 0031), so no new migration.
    key: "trigger_event",
    title: "Trigger Event",
    singular: "trigger event",
    fieldLabel: "Trigger event",
    placeholder: "e.g. Form submitted",
    rowLabel: "Trigger Event",
    hasColor: true,
    hasNotes: true,
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
  /** Notes-bearing columns only (GHL Tags, GHL Forms, Author, Trigger Event):
   *  free-text note. Null/undefined for the plain columns. */
  notes?: string | null;
  /** Color-bearing columns only (Trigger Event): the chosen pill/background
   *  colour key (from CHOICE_COLOR_OPTIONS). Null/undefined otherwise. */
  badgeColor?: string | null;
  /** Color-bearing columns only (Trigger Event): the chosen text colour key.
   *  Null/undefined otherwise. */
  textColor?: string | null;
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

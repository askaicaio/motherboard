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
  | "trigger_event"
  | "triage";

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

// Order = the swatch order in the pickers (this array is only iterated there).
// Neutrals first (Black, Gray, White), then each hue as a trio in DARK, VIBRANT,
// PALE order (dark to light, user-set 2026-07-26).
export const CHOICE_COLOR_OPTIONS: ChoiceColor[] = [
  { key: "black", label: "Black", hex: "#111827" },
  { key: "gray", label: "Gray", hex: "#6b7280" },
  { key: "white", label: "White", hex: "#ffffff" },
  { key: "dark-teal", label: "Dark Teal", hex: "#0f766e" },
  { key: "teal", label: "Teal", hex: "#14b8a6" },
  { key: "pale-teal", label: "Pale Teal", hex: "#ccfbf1" },
  { key: "dark-green", label: "Dark Green", hex: "#15803d" },
  { key: "green", label: "Green", hex: "#22c55e" },
  { key: "pale-green", label: "Pale Green", hex: "#dcfce7" },
  { key: "dark-mint", label: "Dark Mint", hex: "#047857" },
  { key: "mint", label: "Mint", hex: "#6ee7b7" },
  { key: "pale-mint", label: "Pale Mint", hex: "#d1fae5" },
  { key: "dark-cyan", label: "Dark Cyan", hex: "#0e7490" },
  { key: "cyan", label: "Cyan", hex: "#06b6d4" },
  { key: "pale-cyan", label: "Pale Cyan", hex: "#cffafe" },
  { key: "dark-blue", label: "Dark Blue", hex: "#1d4ed8" },
  { key: "blue", label: "Blue", hex: "#3b82f6" },
  { key: "pale-blue", label: "Pale Blue", hex: "#dbeafe" },
  { key: "dark-indigo", label: "Dark Indigo", hex: "#4338ca" },
  { key: "indigo", label: "Indigo", hex: "#6366f1" },
  { key: "pale-indigo", label: "Pale Indigo", hex: "#e0e7ff" },
  { key: "dark-lavender", label: "Dark Lavender", hex: "#6d28d9" },
  { key: "lavender", label: "Lavender", hex: "#c4b5fd" },
  { key: "pale-lavender", label: "Pale Lavender", hex: "#ede9fe" },
  { key: "dark-purple", label: "Dark Purple", hex: "#7e22ce" },
  { key: "purple", label: "Purple", hex: "#8b5cf6" },
  { key: "pale-purple", label: "Pale Purple", hex: "#f3e8ff" },
  { key: "dark-pink", label: "Dark Pink", hex: "#be185d" },
  { key: "pink", label: "Pink", hex: "#ec4899" },
  { key: "pale-pink", label: "Pale Pink", hex: "#fce7f3" },
  { key: "dark-rose", label: "Dark Rose", hex: "#be123c" },
  { key: "rose", label: "Rose", hex: "#f43f5e" },
  { key: "pale-rose", label: "Pale Rose", hex: "#ffe4e6" },
  { key: "dark-red", label: "Dark Red", hex: "#b91c1c" },
  { key: "red", label: "Red", hex: "#ef4444" },
  { key: "pale-red", label: "Pale Red", hex: "#fee2e2" },
  { key: "dark-orange", label: "Dark Orange", hex: "#c2410c" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "pale-orange", label: "Pale Orange", hex: "#ffedd5" },
  { key: "dark-gold", label: "Dark Gold", hex: "#b45309" },
  { key: "gold", label: "Gold", hex: "#f59e0b" },
  { key: "pale-gold", label: "Pale Gold", hex: "#fef3c7" },
  { key: "dark-yellow", label: "Dark Yellow", hex: "#a16207" },
  { key: "yellow", label: "Yellow", hex: "#facc15" },
  { key: "pale-yellow", label: "Pale Yellow", hex: "#fef9c3" },
  { key: "dark-brown", label: "Dark Brown", hex: "#78350f" },
  { key: "brown", label: "Brown", hex: "#92400e" },
  { key: "pale-brown", label: "Pale Brown", hex: "#ede0d4" },
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
  /** Restrict the PER WEBSITE column to these platform slugs (e.g.
   *  `["ghl", "ghl-b2b"]`). Omit → the column is shown on every platform. Drives
   *  both the Per Website table (render the th/td only on these platforms) and
   *  the combined View All Lists table (populate the cell only for these rows).
   *  Generic, so any future platform-specific column is one line of config. */
  visibleOnPlatforms?: string[];
  /** True → rows carry a Status. When set, `statusOptions` lists the choices and
   *  `defaultStatus` is used for a new entry. GHL Tags, GHL Forms. */
  hasStatus?: boolean;
  /** This column's Status choices (present iff hasStatus). PER COLUMN: GHL Tags +
   *  GHL Forms use GHL_TAG_STATUS_OPTIONS. */
  statusOptions?: StatusOption[];
  /** Default status for a new entry (present iff hasStatus). */
  defaultStatus?: string;
  /** True → the Config table GROUPS rows by status order (then alphabetizes
   *  within a group), like GHL Tags + GHL Forms. Omit → plain alphabetical order
   *  (Author). */
  statusGrouped?: boolean;
  /** True → rows carry a free-text Notes field (Purpose-style). GHL Tags, GHL
   *  Forms, Author, Trigger Event, Automation Tags. */
  hasNotes?: boolean;
  /** True → rows carry a Badge Color + Text Color (chosen independently from
   *  CHOICE_COLOR_OPTIONS), and the value renders as a coloured pill preview.
   *  Trigger Event, Author, Automation Tags. Renders as a rich table (like
   *  hasStatus/hasNotes do). */
  hasColor?: boolean;
  /** Header for the FIRST column in the rich (Status/Notes/Color) table view,
   *  e.g. "Tag" for GHL Tags, "Form" for GHL Forms, "Author" for Author,
   *  "Trigger Event" for Trigger Event. Only used by the rich tables. */
  rowLabel?: string;
}

// Order here is the top-to-bottom order the tables render on the Config page.
export const DROPDOWN_COLUMNS: DropdownColumnConfig[] = [
  {
    // Author / Badge Color / Text Color / Notes table. Colour table (hasColor +
    // hasNotes), mirroring Trigger Event: the author value renders as a coloured
    // pill (badge + text colours chosen independently in the Add/Edit dialog),
    // plus the two colour columns and a Purpose-style Notes column. (Formerly had
    // a Status column; removed 2026-07-29 in favour of the colour columns.)
    key: "author",
    title: "Author",
    singular: "author",
    fieldLabel: "Author",
    placeholder: "e.g. Jane Doe",
    rowLabel: "Author",
    hasColor: true,
    hasNotes: true,
  },
  {
    // Automation Tags / Badge Color / Text Color / Notes table. Colour table
    // (hasColor + hasNotes), same shape as Trigger Event; the first column header
    // is "Tag" (rowLabel). Config-page choices only so far — the Per Website
    // multi-select column that consumes these isn't built yet.
    key: "automation_tags",
    title: "Automation Tags",
    singular: "tag",
    fieldLabel: "Tag",
    placeholder: "e.g. Lead capture",
    rowLabel: "Tag",
    hasColor: true,
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
  {
    // Triage / Badge Color / Text Color / Notes table. Colour table, same shape
    // as Author + Trigger Event. Records what should HAPPEN to an automation.
    //
    // Seeded by migration 0049 with the FIVE states that already existed in the
    // imported Notes text — To Remove, To Remove?, Unknown, Keep?, Keep — rather
    // than an invented vocabulary. The trailing "?" means probably-but-
    // unconfirmed and is its own value (user decision 2026-08-20).
    //
    // NOT values, deliberately: "Incomplete" (only ever a REASON attached to
    // "To Remove?" rows, never a state) and "Standby" (occurs nowhere in the
    // data). They can still be added here like any other choice if that changes.
    //
    // Placed after Trigger Event so the Config tabs keep matching the Per Website
    // column order (user-set rule, see the GHL Tags note below).
    // NOTE the user-facing label is "Evaluation" (renamed from "Triage"
    // 2026-08-20 — "triage" read as a medical term). The internal key, the DB
    // column_key, and every variable name stay `triage`, so the rename is
    // display-only: no migration, and TRIAGE_ORDER still matches on the VALUE
    // strings, not the column name.
    key: "triage",
    title: "Evaluation",
    singular: "evaluation",
    fieldLabel: "Evaluation",
    placeholder: "e.g. To Remove",
    rowLabel: "Evaluation",

    hasColor: true,
    hasNotes: true,
  },
  {
    // GHL Tags table. Placed just before Webhook Links in this array so the
    // Config page tabs read Author, Automation Tags, Trigger Event, GHL Tags, GHL
    // Forms, Webhook Links (user-set 2026-07-31), matching the Per Website table
    // column order (GHL Tags + GHL Forms sit left of Webhook Links).
    key: "ghl_tags",
    title: "GHL Tags",
    singular: "GHL tag",
    fieldLabel: "GHL tag",
    placeholder: "e.g. Nurture sequence",
    ghlOnly: true,
    // Per Website column shows only on the two GoHighLevel pages.
    visibleOnPlatforms: ["ghl", "ghl-b2b"],
    hasStatus: true,
    statusOptions: GHL_TAG_STATUS_OPTIONS,
    defaultStatus: DEFAULT_STATUS,
    statusGrouped: true,
    hasNotes: true,
    rowLabel: "Tag",
  },
  {
    // Form / Status / Notes table mirroring GHL Tags (hasStatus + hasNotes); the
    // first column header reads "Form". GHL-gated Per Website column, like GHL
    // Tags. Sits right after GHL Tags, just before Webhook Links.
    key: "ghl_forms",
    title: "GHL Forms",
    singular: "GHL form",
    fieldLabel: "GHL form",
    placeholder: "e.g. Contact form",
    rowLabel: "Form",
    ghlOnly: true,
    // Per Website column shows only on the two GoHighLevel pages.
    visibleOnPlatforms: ["ghl", "ghl-b2b"],
    hasStatus: true,
    statusOptions: GHL_TAG_STATUS_OPTIONS,
    defaultStatus: DEFAULT_STATUS,
    statusGrouped: true,
    hasNotes: true,
  },
];

/** Whether a dropdown column's PER WEBSITE column should render on `platform`.
 *  A column with no `visibleOnPlatforms` shows everywhere; otherwise only on the
 *  listed platform slugs. Drives the GHL-gated columns (GHL Tags, GHL Forms). */
export function columnVisibleOnPlatform(
  key: DropdownColumnKey,
  platform: string,
): boolean {
  const list = DROPDOWN_COLUMNS.find((c) => c.key === key)?.visibleOnPlatforms;
  return !list || list.includes(platform);
}

/** A single option row for one of the four generic dropdown columns. */
export interface DropdownChoiceRow {
  id: string;
  columnKey: DropdownColumnKey;
  value: string;
  /** Status-bearing columns only (GHL Tags, GHL Forms): one of that column's
   *  `statusOptions` values. Null/undefined for the plain columns. */
  status?: string | null;
  /** Notes-bearing columns only (GHL Tags, GHL Forms, Author, Trigger Event):
   *  free-text note. Null/undefined for the plain columns. */
  notes?: string | null;
  /** Color-bearing columns only (Trigger Event, Author, Automation Tags): the
   *  chosen pill/background colour key (from CHOICE_COLOR_OPTIONS). Null/undefined
   *  otherwise. */
  badgeColor?: string | null;
  /** Color-bearing columns only (Trigger Event, Author, Automation Tags): the
   *  chosen text colour key. Null/undefined otherwise. */
  textColor?: string | null;
}

/** A single webhook URL choice. */
export interface WebhookChoiceRow {
  id: string;
  url: string;
  /** Free-text note (like the GHL Tags Notes column). Null/undefined for none. */
  notes?: string | null;
  /** Count of automations that use this webhook, via the automation_webhooks
   *  junction. 0 until the Per Website Webhook Links column populates it. */
  relationships?: number;
  /** The automations that use this webhook (reverse lookup, ordered by name),
   *  for the inline Relationships cell that mirrors the Per Website Webhook Links
   *  column (a gold count + the automation links). */
  relatedAutomations?: RelatedAutomation[];
}

/** One selectable option handed to a Per Website dropdown column's picker
 *  (the searchable dropdown in the Add/Edit Workflow dialog). `id` is the
 *  `automation_dropdown_choices` row id stored on the automation; `value` is
 *  the label shown. Shared by every dropdown-driven column. */
export interface ChoiceOption {
  id: string;
  value: string;
  /** Colour-bearing columns only (Trigger Event, Author): the option's badge +
   *  text colour keys, so a picked value can render as a coloured pill. */
  badgeColor?: string | null;
  textColor?: string | null;
}

/** One selected choice of a MULTI-select column (e.g. an Automation Tag),
 *  resolved from the junction to its value + colours so the cell can render it
 *  as a coloured chip. Same shape as ChoiceOption; named distinctly to read
 *  clearly at the (many-per-row) call sites. */
export interface SelectedChoice {
  id: string;
  value: string;
  badgeColor?: string | null;
  textColor?: string | null;
}

/** One webhook an automation uses (from the automation_webhooks junction),
 *  resolved to its URL for the Webhook Links cell + the multi-select picker. */
export interface SelectedWebhook {
  id: string;
  url: string;
  /** How many OTHER automations also use this webhook, ACROSS ALL PLATFORMS
   *  (0 = this automation is the only user). Attached by getWebhooksByAutomation,
   *  so every consumer of that helper gets it. Powers the passive "shared"
   *  indicator in the Webhook Links cells; the click-through dialog still fetches
   *  its own LIVE counts, which stay authoritative. */
  sharedWith?: number;
}

/** One automation surfaced by the Webhook Links "related automations" lookup:
 *  an automation that uses a given webhook, resolved for cross-platform display
 *  (name / platform / status / link). The lookup spans ALL platforms, so the
 *  list can mix websites; `platform` is the slug (mapped to a label at render). */
export interface RelatedAutomation {
  id: string;
  name: string;
  platform: string;
  /** "active" | "paused" (same shape as automations.status). */
  status: string;
  externalUrl: string;
}

// ---------------------------------------------------------------------------
// Triage ordering
// ---------------------------------------------------------------------------

/** The Triage states in LIFECYCLE order, most-actionable first. Sorting this
 *  column alphabetically would be useless ("Keep" before "To Remove"); the point
 *  of sorting it is to surface what needs action, so the order is explicit.
 *
 *  Matches the values seeded by migration 0049. A choice added later on the
 *  Dropdown Configuration page is not in this list and sorts just AFTER the known
 *  states (but still before untriaged rows), so it stays visible rather than
 *  vanishing to the bottom. */
export const TRIAGE_ORDER = [
  "To Remove",
  "To Remove?",
  "Unknown",
  "Keep?",
  "Keep",
] as const;

/** Comparator body for the Triage column, shared by the Per Website table and
 *  View All Lists so the two cannot drift. `dir` is 1 for asc, -1 for desc.
 *
 *  UNTRIAGED (null) rows always finish LAST in both directions — the blanks-last
 *  rule the date columns and Author follow. Unlike Webhook Links, untriaged really
 *  is a missing value here ("nobody has looked yet"), not a meaningful group, so
 *  floating a wall of them to the top on the flip would never be useful. */
export function compareTriage(
  a: { triage?: string | null },
  b: { triage?: string | null },
  dir: number,
): number {
  const rank = (v: string | null | undefined): number | null => {
    if (!v) return null;
    const i = (TRIAGE_ORDER as readonly string[]).indexOf(v);
    return i === -1 ? TRIAGE_ORDER.length : i;
  };
  const ra = rank(a.triage);
  const rb = rank(b.triage);
  if (ra === null && rb === null) return 0;
  if (ra === null) return 1;
  if (rb === null) return -1;
  return dir * (ra - rb);
}

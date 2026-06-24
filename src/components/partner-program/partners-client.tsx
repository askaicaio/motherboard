"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Search,
  Copy,
  Check,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  UserMinus,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PartnerRow {
  id: string;
  refCode: string;
  name: string;
  email: string;
  company: string | null;
  status: string;
  taxFormStatus: string;
  payoutMethod: string;
  payoutDetails: string | null;
  ghlContactId: string | null;
  notes: string | null;
  isSample: boolean;
  country: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  dateOfBirth: string | null;
  audienceSize: number | null;
  applicationData: Record<string, unknown>;
  taxFormUrl: string | null;
  appliedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  portalLastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  paidCents: number;
  payoutCount: number;
}

function SampleBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      SAMPLE ONLY
    </span>
  );
}

const TAX_FORM_OPTIONS = ["none", "w9", "w8ben", "w8bene", "invalid"] as const;
const PAYOUT_OPTIONS = ["none", "ach", "zelle"] as const;

const TAX_FORM_LABELS: Record<string, string> = {
  none: "None",
  w9: "W-9",
  w8ben: "W-8BEN",
  w8bene: "W-8BEN-E",
  invalid: "Invalid",
};
const PAYOUT_LABELS: Record<string, string> = {
  none: "None",
  ach: "ACH",
  zelle: "Zelle",
};

// Status palette: active/approved=emerald, applied=amber,
// declined/terminated/suspended=zinc/red.
function statusTone(status: string): string {
  switch (status) {
    case "active":
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "applied":
      return "bg-amber-100 text-amber-700";
    case "suspended":
    case "terminated":
      return "bg-red-100 text-red-700";
    case "declined":
      return "bg-zinc-200 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        statusTone(status),
      )}
    >
      {status}
    </span>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(link).then(
          () => {
            setCopied(true);
            toast.success("Referral link copied");
            setTimeout(() => setCopied(false), 1500);
          },
          () => toast.error("Failed to copy"),
        );
      }}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      title={link}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span className="font-mono max-w-[180px] truncate">{link}</span>
    </button>
  );
}

// ─── Money / format helpers ────────────────────────────────────────────────

function fmtUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function payoutSummary(p: PartnerRow): string {
  if (p.payoutCount === 0 && p.paidCents === 0) return "—";
  const noun = p.payoutCount === 1 ? "payout" : "payouts";
  return `${fmtUsd(p.paidCents)} · ${p.payoutCount} ${noun}`;
}

function appStr(data: Record<string, unknown>, key: string): string {
  const v = data?.[key];
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v);
}

// ─── Column / grouping / sort config ───────────────────────────────────────

type ColumnKey =
  | "name"
  | "email"
  | "company"
  | "status"
  | "payouts"
  | "applied"
  | "refCode"
  | "country"
  | "cityState"
  | "dateOfBirth"
  | "audienceSize"
  | "taxFormStatus"
  | "payoutMethod"
  | "platforms"
  | "targetAudience"
  | "howDidYouHear"
  | "profession"
  | "affiliateExperience"
  | "aiExperience"
  | "portalLastLogin"
  | "referralLink";

type SortKey =
  | "name"
  | "email"
  | "company"
  | "status"
  | "applied"
  | "audienceSize"
  | "payouts";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortKey?: SortKey;
  /** Right-aligned numeric-ish columns. */
  align?: "left" | "right";
}

// Order here is the render order in the table.
const COLUMN_DEFS: ColumnDef[] = [
  { key: "name", label: "Name", sortKey: "name" },
  { key: "email", label: "Email", sortKey: "email" },
  { key: "company", label: "Company", sortKey: "company" },
  { key: "status", label: "Status", sortKey: "status" },
  { key: "payouts", label: "Payouts", sortKey: "payouts" },
  { key: "applied", label: "Applied", sortKey: "applied" },
  { key: "refCode", label: "Ref code" },
  { key: "country", label: "Country" },
  { key: "cityState", label: "City / State" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "audienceSize", label: "Audience size", sortKey: "audienceSize", align: "right" },
  { key: "taxFormStatus", label: "Tax form status" },
  { key: "payoutMethod", label: "Payout method" },
  { key: "platforms", label: "Platforms" },
  { key: "targetAudience", label: "Target audience" },
  { key: "howDidYouHear", label: "How heard" },
  { key: "profession", label: "Profession" },
  { key: "affiliateExperience", label: "Affiliate experience" },
  { key: "aiExperience", label: "AI experience" },
  { key: "portalLastLogin", label: "Portal last login" },
  { key: "referralLink", label: "Referral link" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "name",
  "email",
  "company",
  "status",
  "payouts",
  "applied",
];

const COLUMN_STORAGE_KEY = "caio.partners.columns";

// ─── Column-visibility store (localStorage-backed, SSR-safe) ───────────────
// Modeled with useSyncExternalStore so the persisted prefs are read without a
// setState-in-effect, and survive reloads.

const DEFAULT_COLUMNS_JSON = JSON.stringify(DEFAULT_COLUMNS);

function readColumnsRaw(): string {
  if (typeof window === "undefined") return DEFAULT_COLUMNS_JSON;
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter((k) => COLUMN_DEFS.some((c) => c.key === k));
      if (valid.length) return JSON.stringify(valid);
    }
  } catch {
    /* ignore malformed localStorage */
  }
  return DEFAULT_COLUMNS_JSON;
}

const columnListeners = new Set<() => void>();

function subscribeColumns(cb: () => void): () => void {
  columnListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLUMN_STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    columnListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function writeColumns(cols: ColumnKey[]) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
  columnListeners.forEach((cb) => cb());
}

function useVisibleColumns(): [Set<ColumnKey>, (key: ColumnKey) => void] {
  const raw = useSyncExternalStore(
    subscribeColumns,
    readColumnsRaw,
    () => DEFAULT_COLUMNS_JSON,
  );
  const set = useMemo(
    () => new Set(JSON.parse(raw) as ColumnKey[]),
    [raw],
  );
  const toggle = (key: ColumnKey) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    writeColumns([...next]);
  };
  return [set, toggle];
}

// Group order: Active first, then the rest of the lifecycle.
const GROUP_ORDER = [
  "active",
  "applied",
  "approved",
  "suspended",
  "declined",
  "terminated",
] as const;

const GROUP_LABELS: Record<string, string> = {
  active: "Active",
  applied: "Applied",
  approved: "Approved",
  suspended: "Suspended",
  declined: "Declined",
  terminated: "Terminated",
};

function groupRank(status: string): number {
  const i = GROUP_ORDER.indexOf(status as (typeof GROUP_ORDER)[number]);
  return i === -1 ? GROUP_ORDER.length : i;
}

// ─── Sort comparator ───────────────────────────────────────────────────────

function compareBy(a: PartnerRow, b: PartnerRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "email":
      return a.email.localeCompare(b.email);
    case "company":
      return (a.company || "").localeCompare(b.company || "");
    case "status":
      return a.status.localeCompare(b.status);
    case "applied":
      return (
        (a.appliedAt ? Date.parse(a.appliedAt) : 0) -
        (b.appliedAt ? Date.parse(b.appliedAt) : 0)
      );
    case "audienceSize":
      return (a.audienceSize ?? -1) - (b.audienceSize ?? -1);
    case "payouts":
      return a.paidCents - b.paidCents;
    default:
      return 0;
  }
}

export function PartnersClient({
  initialPartners,
  baseUrl,
}: {
  initialPartners: PartnerRow[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialPartners);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PartnerRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [grouped, setGrouped] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [visibleColumns, toggleColumn] = useVisibleColumns();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const refLink = (refCode: string) => `${baseUrl}/r?aff=${refCode}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.company, r.refCode, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  // Sorted + (optionally) grouped view model.
  const groups = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const sortRows = (list: PartnerRow[]) =>
      [...list].sort((a, b) => dir * compareBy(a, b, sortKey));

    if (!grouped) {
      return [{ status: "__all__", label: "All", rows: sortRows(filtered) }];
    }

    const byStatus = new Map<string, PartnerRow[]>();
    for (const r of filtered) {
      const arr = byStatus.get(r.status) ?? [];
      arr.push(r);
      byStatus.set(r.status, arr);
    }
    return [...byStatus.entries()]
      .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
      .map(([status, list]) => ({
        status,
        label: GROUP_LABELS[status] ?? status,
        rows: sortRows(list),
      }));
  }, [filtered, grouped, sortKey, sortDir]);

  const visibleColDefs = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumns.has(c.key)),
    [visibleColumns],
  );
  // +1 for the trailing Actions column.
  const colSpan = visibleColDefs.length + 1;

  const handleUpdated = (updated: Partial<PartnerRow> & { id: string }) => {
    // The API returns the raw partner row (no computed tally / applicationData
    // typing). Merge onto the existing row so computed fields survive.
    setRows((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    );
    setSelected((s) =>
      s && s.id === updated.id ? { ...s, ...updated } : s,
    );
  };
  const handleCreated = (created: PartnerRow) => {
    // Manual create returns the raw row; backfill computed defaults.
    const row: PartnerRow = {
      ...created,
      applicationData: created.applicationData ?? {},
      paidCents: created.paidCents ?? 0,
      payoutCount: created.payoutCount ?? 0,
    };
    setRows((prev) => [row, ...prev]);
    toast.success(`Added ${row.name}`);
    router.refresh();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Affiliates</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your affiliates — review applications, approve, and track
            payout readiness.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          New affiliate
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search name, email, company, code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Group control */}
        <Select
          value={grouped ? "status" : "none"}
          onValueChange={(v) => setGrouped(v === "status")}
        >
          <SelectTrigger className="h-9 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Group by status</SelectItem>
            <SelectItem value="none">All / ungrouped</SelectItem>
          </SelectContent>
        </Select>

        {/* Column picker */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Table settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[60vh] w-56 overflow-y-auto"
          >
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Show columns
            </div>
            <DropdownMenuSeparator />
            {COLUMN_DEFS.map((col) => (
              <DropdownMenuItem
                key={col.key}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleColumn(col.key);
                }}
                className="gap-2"
              >
                <Checkbox
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <span>{col.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            No affiliates match your search.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColDefs.map((col) => (
                    <SortableHead
                      key={col.key}
                      col={col}
                      activeSort={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <GroupSection
                    key={g.status}
                    grouped={grouped}
                    label={g.label}
                    count={g.rows.length}
                    colSpan={colSpan}
                  >
                    {g.rows.map((r) => (
                      <PartnerTableRow
                        key={r.id}
                        partner={r}
                        columns={visibleColDefs}
                        refLink={refLink}
                        onOpen={() => setSelected(r)}
                        onUpdated={handleUpdated}
                        router={router}
                      />
                    ))}
                  </GroupSection>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PartnerDetailDialog
        partner={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onUpdated={handleUpdated}
        refLink={refLink}
        router={router}
      />
      <NewPartnerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

// ─── Table head with click-to-sort ─────────────────────────────────────────

function SortableHead({
  col,
  activeSort,
  sortDir,
  onSort,
}: {
  col: ColumnDef;
  activeSort: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const alignRight = col.align === "right";
  if (!col.sortKey) {
    return (
      <TableHead className={cn(alignRight && "text-right")}>
        {col.label}
      </TableHead>
    );
  }
  const isActive = activeSort === col.sortKey;
  return (
    <TableHead className={cn(alignRight && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(col.sortKey!)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-zinc-900",
          alignRight && "flex-row-reverse",
          isActive ? "text-zinc-900" : "text-zinc-500",
        )}
      >
        <span>{col.label}</span>
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

// ─── Group section header ──────────────────────────────────────────────────

function GroupSection({
  grouped,
  label,
  count,
  colSpan,
  children,
}: {
  grouped: boolean;
  label: string;
  count: number;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {grouped && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={colSpan}
            className="bg-zinc-50 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            {label}
            <span className="ml-2 font-normal normal-case text-zinc-400">
              {count}
            </span>
          </TableCell>
        </TableRow>
      )}
      {children}
    </>
  );
}

// ─── A single affiliate row ────────────────────────────────────────────────

function PartnerTableRow({
  partner: r,
  columns,
  refLink,
  onOpen,
  onUpdated,
  router,
}: {
  partner: PartnerRow;
  columns: ColumnDef[];
  refLink: (refCode: string) => string;
  onOpen: () => void;
  onUpdated: (p: Partial<PartnerRow> & { id: string }) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const cellFor = (key: ColumnKey) => {
    switch (key) {
      case "name":
        return (
          <TableCell key={key} className="font-medium">
            <div className="flex items-center gap-1.5">
              <span>{r.name}</span>
              {r.isSample && <SampleBadge />}
            </div>
          </TableCell>
        );
      case "email":
        return (
          <TableCell key={key} className="font-mono text-xs text-zinc-600">
            {r.email}
          </TableCell>
        );
      case "company":
        return (
          <TableCell key={key} className="text-zinc-600">
            {r.company || <span className="text-zinc-400">—</span>}
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={key}>
            <StatusBadge status={r.status} />
          </TableCell>
        );
      case "payouts":
        return (
          <TableCell key={key} className="text-xs text-zinc-700">
            {payoutSummary(r)}
          </TableCell>
        );
      case "applied":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {fmtDate(r.appliedAt)}
          </TableCell>
        );
      case "refCode":
        return (
          <TableCell key={key} className="font-mono text-xs text-zinc-600">
            {r.refCode || "—"}
          </TableCell>
        );
      case "country":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {r.country || "—"}
          </TableCell>
        );
      case "cityState":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {[r.city, r.state].filter(Boolean).join(", ") || "—"}
          </TableCell>
        );
      case "dateOfBirth":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {r.dateOfBirth || "—"}
          </TableCell>
        );
      case "audienceSize":
        return (
          <TableCell key={key} className="text-right text-xs text-zinc-600">
            {r.audienceSize != null
              ? r.audienceSize.toLocaleString("en-US")
              : "—"}
          </TableCell>
        );
      case "taxFormStatus":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {TAX_FORM_LABELS[r.taxFormStatus] ?? r.taxFormStatus}
          </TableCell>
        );
      case "payoutMethod":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {PAYOUT_LABELS[r.payoutMethod] ?? r.payoutMethod}
          </TableCell>
        );
      case "platforms":
        return (
          <TableCell key={key} className="max-w-[220px] truncate text-xs text-zinc-600">
            {appStr(r.applicationData, "platforms") || "—"}
          </TableCell>
        );
      case "targetAudience":
        return (
          <TableCell key={key} className="max-w-[220px] truncate text-xs text-zinc-600">
            {appStr(r.applicationData, "targetAudience") || "—"}
          </TableCell>
        );
      case "howDidYouHear":
        return (
          <TableCell key={key} className="max-w-[200px] truncate text-xs text-zinc-600">
            {appStr(r.applicationData, "howDidYouHear") || "—"}
          </TableCell>
        );
      case "profession":
        return (
          <TableCell key={key} className="max-w-[200px] truncate text-xs text-zinc-600">
            {appStr(r.applicationData, "profession") || "—"}
          </TableCell>
        );
      case "affiliateExperience":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {appStr(r.applicationData, "affiliateExperienceLevel") || "—"}
          </TableCell>
        );
      case "aiExperience":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {appStr(r.applicationData, "aiExperienceLevel") || "—"}
          </TableCell>
        );
      case "portalLastLogin":
        return (
          <TableCell key={key} className="text-xs text-zinc-600">
            {fmtDate(r.portalLastLoginAt)}
          </TableCell>
        );
      case "referralLink":
        return (
          <TableCell key={key} onClick={(e) => e.stopPropagation()}>
            {r.refCode ? (
              <CopyLinkButton link={refLink(r.refCode)} />
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </TableCell>
        );
      default:
        return <TableCell key={key}>—</TableCell>;
    }
  };

  return (
    <TableRow onClick={onOpen} className="cursor-pointer">
      {columns.map((c) => cellFor(c.key))}
      <TableCell
        className="text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <RowActions partner={r} onUpdated={onUpdated} router={router} />
      </TableCell>
    </TableRow>
  );
}

// ─── Per-row actions (tax form link + offboard) ────────────────────────────

function RowActions({
  partner,
  onUpdated,
  router,
}: {
  partner: PartnerRow;
  onUpdated: (p: Partial<PartnerRow> & { id: string }) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const canOffboard = ["active", "approved", "suspended"].includes(
    partner.status,
  );
  const canView = ["active", "approved"].includes(partner.status);

  async function viewAs() {
    setViewing(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/view-as`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not open the affiliate's portal.");
        return;
      }
      window.open(data.portalUrl || "/portal", "_blank");
    } finally {
      setViewing(false);
    }
  }

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      {canView && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={viewing}
          onClick={viewAs}
        >
          <Eye className="h-3 w-3" />
          View as
        </Button>
      )}
      {partner.taxFormUrl && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() =>
            window.open(`/api/partners/${partner.id}/tax-form`, "_blank")
          }
        >
          <FileText className="h-3 w-3" />
          Tax form
        </Button>
      )}
      {canOffboard && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-red-600 hover:text-red-700"
          onClick={() => setOffboardOpen(true)}
        >
          <UserMinus className="h-3 w-3" />
          Offboard
        </Button>
      )}
      <OffboardDialog
        partner={partner}
        open={offboardOpen}
        onOpenChange={setOffboardOpen}
        onUpdated={onUpdated}
        router={router}
      />
    </div>
  );
}

// ─── Offboard (suspend / terminate) confirm dialog ─────────────────────────

function OffboardDialog({
  partner,
  open,
  onOpenChange,
  onUpdated,
  router,
}: {
  partner: PartnerRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: (p: Partial<PartnerRow> & { id: string }) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [busy, setBusy] = useState(false);

  const offboard = async (status: "suspended" | "terminated") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Failed to update affiliate");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success(
        status === "suspended"
          ? `${partner.name} suspended`
          : `${partner.name} terminated`,
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to update affiliate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Offboard {partner.name}</DialogTitle>
          <DialogDescription>
            Choose how to remove this affiliate from the program. Suspend is
            reversible (you can reactivate later); Terminate is permanent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="font-medium text-amber-800">Suspend</div>
            <p className="mt-0.5 text-xs text-amber-700">
              Pauses the affiliate. Their portal access is revoked but the
              account can be reactivated.
            </p>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="font-medium text-red-800">Terminate</div>
            <p className="mt-0.5 text-xs text-red-700">
              Permanently ends the relationship. This cannot be undone.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-amber-700 hover:text-amber-800"
            onClick={() => offboard("suspended")}
            disabled={busy}
          >
            Suspend
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => offboard("terminated")}
            disabled={busy}
          >
            Terminate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail + Edit dialog ──────────────────────────────────────────────────

function PartnerDetailDialog({
  partner,
  onOpenChange,
  onUpdated,
  refLink,
  router,
}: {
  partner: PartnerRow | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (p: Partial<PartnerRow> & { id: string }) => void;
  refLink: (refCode: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [taxFormStatus, setTaxFormStatus] = useState<string>("none");
  const [payoutMethod, setPayoutMethod] = useState<string>("none");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [offboardOpen, setOffboardOpen] = useState(false);
  // Track which partner the form is currently synced to so we re-seed
  // the controlled inputs whenever a different row is opened.
  const [syncedId, setSyncedId] = useState<string | null>(null);

  if (partner && partner.id !== syncedId) {
    setSyncedId(partner.id);
    setName(partner.name);
    setCompany(partner.company || "");
    setTaxFormStatus(partner.taxFormStatus);
    setPayoutMethod(partner.payoutMethod);
    setPayoutDetails(partner.payoutDetails || "");
    setNotes(partner.notes || "");
    setDeclineReason("");
  }

  const open = !!partner;

  const handleSave = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          taxFormStatus,
          payoutMethod,
          payoutDetails,
          notes,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to approve");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Approved — welcome email sent");
      router.refresh();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) {
        toast.error("Failed to decline");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Application declined");
      router.refresh();
    } catch {
      toast.error("Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  const canOffboard =
    !!partner && ["active", "approved", "suspended"].includes(partner.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {partner?.name}
            {partner && <StatusBadge status={partner.status} />}
            {partner?.isSample && <SampleBadge />}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {partner?.email}
          </DialogDescription>
        </DialogHeader>

        {partner && (
          <div className="space-y-4">
            {/* Read-only facts */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Fact label="Ref code" value={partner.refCode || "—"} mono />
              <Fact label="Applied" value={fmtDate(partner.appliedAt)} />
              <Fact label="Approved" value={fmtDate(partner.approvedAt)} />
              <Fact label="Declined" value={fmtDate(partner.declinedAt)} />
              <Fact label="Payouts received" value={payoutSummary(partner)} />
              <Fact
                label="Portal last login"
                value={fmtDate(partner.portalLastLoginAt)}
              />
            </div>

            {partner.refCode && (
              <div>
                <Label className="text-xs text-zinc-500">Referral link</Label>
                <div className="mt-1">
                  <CopyLinkButton link={refLink(partner.refCode)} />
                </div>
              </div>
            )}

            {partner.taxFormUrl && (
              <div>
                <Label className="text-xs text-zinc-500">Tax form</Label>
                <div className="mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() =>
                      window.open(
                        `/api/partners/${partner.id}/tax-form`,
                        "_blank",
                      )
                    }
                  >
                    <FileText className="h-3 w-3" />
                    Open tax form
                  </Button>
                </div>
              </div>
            )}

            {/* Applied: approve / decline */}
            {partner.status === "applied" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="text-xs font-medium text-amber-800">
                  This application is pending review.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handleApprove} disabled={busy}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDecline}
                    disabled={busy}
                  >
                    Decline
                  </Button>
                </div>
                <Input
                  placeholder="Decline reason (optional)"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            {/* Active/approved: offboard */}
            {canOffboard && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-600">
                    Remove this affiliate from the program.
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs text-red-600 hover:text-red-700"
                    onClick={() => setOffboardOpen(true)}
                  >
                    <UserMinus className="h-3 w-3" />
                    Offboard
                  </Button>
                </div>
              </div>
            )}

            {partner.declineReason && (
              <Fact label="Decline reason" value={partner.declineReason} />
            )}

            {/* Edit form */}
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-company">Company</Label>
                <Input
                  id="p-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tax form</Label>
                  <Select
                    value={taxFormStatus}
                    onValueChange={(v) => setTaxFormStatus(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_FORM_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {TAX_FORM_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payout method</Label>
                  <Select
                    value={payoutMethod}
                    onValueChange={(v) => setPayoutMethod(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {PAYOUT_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-payout">Payout details</Label>
                <Textarea
                  id="p-payout"
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  placeholder="Bank routing notes, Zelle handle, etc."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-notes">Notes</Label>
                <Textarea
                  id="p-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {partner && (
        <OffboardDialog
          partner={partner}
          open={offboardOpen}
          onOpenChange={setOffboardOpen}
          onUpdated={onUpdated}
          router={router}
        />
      )}
    </Dialog>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm text-zinc-800", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── New partner dialog ────────────────────────────────────────────────────

function NewPartnerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (p: PartnerRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setCompany("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to create affiliate");
        return;
      }
      const { partner } = await res.json();
      onCreated(partner);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create partner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New affiliate</DialogTitle>
          <DialogDescription>
            Manually add an affiliate. They&apos;ll start in the
            &ldquo;applied&rdquo; state.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-company">Company (optional)</Label>
            <Input
              id="np-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

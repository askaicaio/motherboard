"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Plus,
  Search,
  Star,
  ExternalLink,
  Download,
  Table as TableIcon,
  LayoutGrid,
  List as ListIcon,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Pencil,
  Archive,
} from "lucide-react";
import {
  format,
  parseISO,
  differenceInDays,
  isValid as dateIsValid,
} from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EditSubscriptionDialog } from "./edit-subscription-dialog";

/** A row marked for rendering — children get a transient _isChild flag. */
interface DisplayRow extends SubscriptionRow {
  _isChild?: boolean;
}

/** Splice each parent's children right after it for table-like rendering. */
function flattenWithChildren(
  parents: SubscriptionRow[],
  childrenByParent: Map<string, SubscriptionRow[]>,
): DisplayRow[] {
  const out: DisplayRow[] = [];
  for (const p of parents) {
    out.push(p);
    const kids = childrenByParent.get(p.id) || [];
    for (const k of kids) out.push({ ...k, _isChild: true });
  }
  return out;
}

export interface SubscriptionRow {
  id: string;
  externalId: string | null;
  name: string;
  serviceName: string | null;
  ownerEmail: string | null;
  /** Optional short label shown on nested (child) rows instead of the app name. */
  label: string | null;
  isStarred: boolean;
  websiteUrl: string | null;
  departments: string[];
  inOnePassword: boolean;
  monthlyCostUsd: number | null;
  annualCostUsd: number | null;
  /** Per-seat billing (team plans) — monthly = seats × perSeatCostUsd. */
  seats: number | null;
  perSeatCostUsd: number | null;
  renewalDate: string | null;
  renewalDayOfMonth: number | null;
  notes: string | null;
  tag: string | null;
  status: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "table" | "cards" | "compact";
type SortKey =
  | "name"
  | "monthlyDesc"
  | "monthlyAsc"
  | "annualDesc"
  | "renewalSoonest"
  | "renewalLatest";
type GroupKey = "none" | "department" | "owner" | "status" | "renewalMonth";

// Status palette — keyword-based so new ClickUp statuses we haven't seen
// before still land on a reasonable colour. Order matters: first match wins.
const STATUS_TONE_RULES: Array<{ match: RegExp; tone: string }> = [
  { match: /not\s*working|broken/i,            tone: "bg-red-100 text-red-700" },
  { match: /cancel|removed|terminat/i,          tone: "bg-zinc-200 text-zinc-700" },
  { match: /to\s*be\s*verified|review|pending/i,tone: "bg-amber-100 text-amber-700" },
  { match: /sensitive|secur/i,                  tone: "bg-purple-100 text-purple-700" },
  { match: /archived/i,                         tone: "bg-zinc-100 text-zinc-500" },
  { match: /free/i,                             tone: "bg-sky-100 text-sky-700" },
  { match: /team\s*plan|enterprise/i,           tone: "bg-indigo-100 text-indigo-700" },
  { match: /subscription|active|annual|auto/i,  tone: "bg-emerald-100 text-emerald-700" },
];
function statusTone(status: string): string {
  for (const r of STATUS_TONE_RULES) if (r.match.test(status)) return r.tone;
  return "bg-zinc-100 text-zinc-700";
}

// Department pills get a stable colour derived from the name, so the same
// department always reads the same colour across every row without us
// maintaining a hand-kept map.
const DEPT_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-lime-100 text-lime-700",
  "bg-orange-100 text-orange-700",
  "bg-sky-100 text-sky-700",
];
function deptTone(name: string): string {
  let h = 0;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DEPT_TONES[h % DEPT_TONES.length];
}
function DeptBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        deptTone(name),
      )}
    >
      {name}
    </span>
  );
}

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Days from today until the next occurrence of day-N-of-the-month. */
function daysUntilNextMonthly(dayOfMonth: number): number {
  const today = new Date();
  const Y = today.getFullYear();
  const M = today.getMonth();
  const D = today.getDate();
  const lastDayThis = new Date(Y, M + 1, 0).getDate();
  const lastDayNext = new Date(Y, M + 2, 0).getDate();
  const clampedThis = Math.min(dayOfMonth, lastDayThis);
  const target =
    clampedThis >= D
      ? new Date(Y, M, clampedThis)
      : new Date(Y, M + 1, Math.min(dayOfMonth, lastDayNext));
  return Math.ceil(
    (target.getTime() - new Date(Y, M, D).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * A row is "billed annually" when it carries an annual cost with no monthly
 * cost (a yearly lump sum). Only those show the year on their renewal date —
 * everything else recurs often enough that the year is noise.
 */
function isAnnualBilled(r: {
  monthlyCostUsd: number | null;
  annualCostUsd: number | null;
}): boolean {
  return r.annualCostUsd != null && r.monthlyCostUsd == null;
}

function fmtRenewal(
  d: string | null,
  dayOfMonth: number | null = null,
  annual = false,
): {
  text: string;
  daysOut: number | null;
  /** True when this is a monthly-recurring renewal (vs a one-time date). */
  monthly: boolean;
} {
  // Monthly cadence wins when set — we compute next occurrence on the fly
  if (dayOfMonth != null && dayOfMonth >= 1 && dayOfMonth <= 31) {
    return {
      text: `Every ${ordinal(dayOfMonth)}`,
      daysOut: daysUntilNextMonthly(dayOfMonth),
      monthly: true,
    };
  }
  if (!d) return { text: "—", daysOut: null, monthly: false };
  try {
    const parsed = parseISO(d);
    if (!dateIsValid(parsed)) return { text: d, daysOut: null, monthly: false };
    const days = differenceInDays(parsed, new Date());
    return {
      // Year only for annual (yearly lump-sum) subscriptions.
      text: format(parsed, annual ? "MMM d, yyyy" : "MMM d"),
      daysOut: days,
      monthly: false,
    };
  } catch {
    return { text: d, daysOut: null, monthly: false };
  }
}

/** Safely extract a host for display. Returns null on malformed URLs. */
function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function SubscriptionsPageClient({
  initialRows,
}: {
  initialRows: SubscriptionRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [sort, setSort] = useState<SortKey>("name");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [editMode, setEditMode] = useState(false);
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [in1pFilter, setIn1pFilter] = useState<"any" | "yes" | "no">("any");
  const [renewSoon, setRenewSoon] = useState(false);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // When adding a credential from a specific parent's "+" action, we preset
  // the parent in the Add dialog so the new row nests correctly.
  const [addParentId, setAddParentId] = useState<string>("");

  // Index children by parent id so we can render them under their parent
  // in the table/card/compact views. Filtering happens on parents only —
  // children always travel with their parent.
  const childrenByParent = useMemo(() => {
    const m = new Map<string, SubscriptionRow[]>();
    for (const r of rows) {
      if (r.parentId) {
        const arr = m.get(r.parentId) || [];
        arr.push(r);
        m.set(r.parentId, arr);
      }
    }
    // Sort children alphabetically by owner email then name
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        (a.ownerEmail || "").localeCompare(b.ownerEmail || "") ||
        a.name.localeCompare(b.name),
      );
    }
    return m;
  }, [rows]);

  const topLevelRows = useMemo(
    () => rows.filter((r) => !r.parentId),
    [rows],
  );

  // Derive the universe of departments for the filter dropdown
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const d of r.departments) set.add(d);
    return Array.from(set).sort();
  }, [rows]);

  // Derive the universe of statuses from actual data (so new ClickUp
  // values show up in the filter automatically without code edits).
  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.status) set.add(r.status);
    return Array.from(set).sort();
  }, [rows]);

  // Apply filters + search — over TOP-LEVEL rows only. Children travel
  // with their parent. (A parent matches if it OR any of its children
  // match the search query, so searching "operations@" still surfaces
  // the Claude parent.)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topLevelRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (in1pFilter === "yes" && !r.inOnePassword) return false;
      if (in1pFilter === "no" && r.inOnePassword) return false;
      if (renewSoon) {
        const { daysOut } = fmtRenewal(r.renewalDate, r.renewalDayOfMonth);
        if (daysOut == null || daysOut < 0 || daysOut > 30) return false;
      }
      if (deptFilter.size > 0) {
        const hit = r.departments.some((d) => deptFilter.has(d));
        if (!hit) return false;
      }
      if (q) {
        const kids = childrenByParent.get(r.id) || [];
        const haystack = [
          r.name,
          r.serviceName,
          r.ownerEmail,
          r.label,
          r.notes,
          r.tag,
          ...r.departments,
          // Include child names, labels + owners so searching "operations@" or
          // a seat's label still surfaces the parent it nests under.
          ...kids.flatMap((k) => [k.name, k.label, k.ownerEmail, k.serviceName]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [topLevelRows, query, statusFilter, in1pFilter, renewSoon, deptFilter, childrenByParent]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmpRenewal = (a: SubscriptionRow, b: SubscriptionRow, dir: 1 | -1) => {
      if (!a.renewalDate && !b.renewalDate) return 0;
      if (!a.renewalDate) return 1; // nulls always last
      if (!b.renewalDate) return -1;
      return dir * a.renewalDate.localeCompare(b.renewalDate);
    };
    arr.sort((a, b) => {
      // Starred always rises within its group
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      switch (sort) {
        case "monthlyDesc":
          return (b.monthlyCostUsd ?? -1) - (a.monthlyCostUsd ?? -1);
        case "monthlyAsc":
          return (a.monthlyCostUsd ?? Infinity) - (b.monthlyCostUsd ?? Infinity);
        case "annualDesc":
          return (b.annualCostUsd ?? -1) - (a.annualCostUsd ?? -1);
        case "renewalSoonest":
          return cmpRenewal(a, b, 1);
        case "renewalLatest":
          return cmpRenewal(a, b, -1);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return arr;
  }, [filtered, sort]);

  // Group
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "All", items: sorted }];
    const map = new Map<string, SubscriptionRow[]>();
    for (const r of sorted) {
      let keys: string[] = [];
      if (groupBy === "department") {
        keys = r.departments.length > 0 ? r.departments : ["(no department)"];
      } else if (groupBy === "owner") {
        keys = [r.ownerEmail || "(shared / no owner)"];
      } else if (groupBy === "status") {
        keys = [r.status];
      } else if (groupBy === "renewalMonth") {
        if (!r.renewalDate) {
          keys = ["(no renewal date)"];
        } else {
          try {
            const dt = parseISO(r.renewalDate);
            keys = [dateIsValid(dt) ? format(dt, "MMM yyyy") : "(unknown)"];
          } catch {
            keys = ["(unknown)"];
          }
        }
      }
      for (const k of keys) {
        const arr = map.get(k) || [];
        arr.push(r);
        map.set(k, arr);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        // Move "no X" buckets to the end
        if (a.startsWith("(") && !b.startsWith("(")) return 1;
        if (!a.startsWith("(") && b.startsWith("(")) return -1;
        return a.localeCompare(b);
      })
      .map(([key, items]) => ({ key, items }));
  }, [sorted, groupBy]);

  // Summary stats (over the FILTERED list — reflects what user is looking at)
  const stats = useMemo(() => {
    const totalMonthly = filtered.reduce(
      (s, r) => s + (r.monthlyCostUsd ?? 0),
      0,
    );
    const totalAnnual = filtered.reduce(
      (s, r) => s + (r.annualCostUsd ?? 0),
      0,
    );
    const inOnePw = filtered.filter((r) => r.inOnePassword).length;
    const renewing30 = filtered.filter((r) => {
      const { daysOut } = fmtRenewal(r.renewalDate, r.renewalDayOfMonth);
      return daysOut != null && daysOut >= 0 && daysOut <= 30;
    }).length;
    return {
      count: filtered.length,
      totalMonthly,
      totalAnnual,
      inOnePw,
      renewing30,
    };
  }, [filtered]);

  // ─── Mutations ────────────────────────────────────────────────────────
  const handleSaved = (updated: SubscriptionRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };
  const handleCreated = (created: SubscriptionRow) => {
    setRows((prev) => [created, ...prev]);
    toast.success(
      created.parentId
        ? `Added credential${created.label ? ` "${created.label}"` : ""}`
        : `Added ${created.name}`,
    );
  };
  // Open the Add dialog pre-nested under a parent (adds a credential/seat).
  const openAddCredential = (parent: SubscriptionRow) => {
    setAddParentId(parent.id);
    setAddOpen(true);
  };
  const openAddTopLevel = () => {
    setAddParentId("");
    setAddOpen(true);
  };
  const handleArchive = async (row: SubscriptionRow) => {
    // Show the identifier the user actually sees on the row (a child shows its
    // label/owner, never the derived internal name).
    const shown = row.parentId
      ? row.label || row.ownerEmail || "this credential"
      : row.serviceName || row.name;
    if (!confirm(`Archive "${shown}"?`)) return;
    const res = await fetch(`/api/subscriptions/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to archive");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Archived");
    router.refresh();
  };

  const exportCsv = () => {
    const headers = [
      "Name",
      "Service",
      "Owner",
      "Label",
      "Parent",
      "Starred",
      "Website",
      "Departments",
      "In 1Password",
      "Monthly ($)",
      "Annual ($)",
      "Renewal Date",
      "Notes",
      "Tag",
      "Status",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    // Export parents AND their nested credential/seat rows, so the Label
    // column (which lives on children) actually carries data. The Parent
    // column names the app each credential belongs to.
    const parentNameById = new Map(
      topLevelRows.map((p) => [p.id, p.serviceName || p.name]),
    );
    const exportRows = flattenWithChildren(sorted, childrenByParent);
    for (const r of exportRows) {
      lines.push(
        [
          r.name,
          r.serviceName,
          r.ownerEmail,
          r.label,
          r.parentId ? parentNameById.get(r.parentId) ?? "" : "",
          r.isStarred ? "yes" : "",
          r.websiteUrl,
          r.departments.join(" | "),
          r.inOnePassword ? "yes" : "",
          r.monthlyCostUsd,
          r.annualCostUsd,
          r.renewalDate,
          r.notes,
          r.tag,
          r.status,
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Subscriptions
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            SaaS &amp; tools spend ledger. Toggle Edit mode to modify rows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={openAddTopLevel}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Summary cards — reflect the filtered view */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Visible" value={String(stats.count)} />
        <SummaryCard label="Monthly" value={fmtUsd(stats.totalMonthly)} />
        <SummaryCard label="Annual" value={fmtUsd(stats.totalAnnual)} />
        <SummaryCard label="In 1Password" value={String(stats.inOnePw)} />
        <SummaryCard
          label="Renewing ≤30d"
          value={String(stats.renewing30)}
          highlight={stats.renewing30 > 0}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search name, owner, notes, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* View mode */}
        <div className="inline-flex rounded-md border bg-white p-0.5 text-zinc-500">
          <ViewBtn active={view === "table"} onClick={() => setView("table")} icon={<TableIcon className="h-3.5 w-3.5" />} label="Table" />
          <ViewBtn active={view === "cards"} onClick={() => setView("cards")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Cards" />
          <ViewBtn active={view === "compact"} onClick={() => setView("compact")} icon={<ListIcon className="h-3.5 w-3.5" />} label="Compact" />
        </div>

        {/* Group by */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            Group: {groupBy === "none" ? "None" : groupBy === "renewalMonth" ? "Renewal month" : groupBy[0].toUpperCase() + groupBy.slice(1)}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Group by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setGroupBy("none")}>None</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setGroupBy("department")}>Department</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setGroupBy("owner")}>Owner</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setGroupBy("status")}>Status</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setGroupBy("renewalMonth")}>Renewal month</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
            {SORT_LABEL[sort]}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSort("name")}>Name A–Z</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("monthlyDesc")}>Monthly: high → low</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("monthlyAsc")}>Monthly: low → high</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("annualDesc")}>Annual: high → low</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("renewalSoonest")}>Renewal: soonest</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSort("renewalLatest")}>Renewal: latest</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <Filter className="mr-1 h-3.5 w-3.5" />
            Filters
            {(deptFilter.size > 0 || statusFilter !== "all" || in1pFilter !== "any" || renewSoon) && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {(deptFilter.size > 0 ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (in1pFilter !== "any" ? 1 : 0) + (renewSoon ? 1 : 0)}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setStatusFilter("all");
              }}
            >
              {statusFilter === "all" ? "✓ " : "  "}All
            </DropdownMenuItem>
            {allStatuses.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  setStatusFilter(s);
                }}
              >
                {statusFilter === s ? "✓ " : "  "}
                {s}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">In 1Password</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setIn1pFilter("any")}>{in1pFilter === "any" ? "✓ " : "  "}Any</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIn1pFilter("yes")}>{in1pFilter === "yes" ? "✓ " : "  "}In 1Password</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIn1pFilter("no")}>{in1pFilter === "no" ? "✓ " : "  "}Not in 1Password</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Renewal</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setRenewSoon((v) => !v)}>
              {renewSoon ? "✓ " : "  "}Renewing within 30 days
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Departments</DropdownMenuLabel>
            {allDepartments.length === 0 && (
              <div className="px-2 py-1 text-xs text-zinc-400">(none)</div>
            )}
            {allDepartments.map((d) => (
              <DropdownMenuItem
                key={d}
                onSelect={(e) => {
                  e.preventDefault();
                  setDeptFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(d)) next.delete(d);
                    else next.add(d);
                    return next;
                  });
                }}
              >
                {deptFilter.has(d) ? "✓ " : "  "}{d}
              </DropdownMenuItem>
            ))}
            {(deptFilter.size > 0 ||
              statusFilter !== "all" ||
              in1pFilter !== "any" ||
              renewSoon) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setDeptFilter(new Set());
                    setStatusFilter("all");
                    setIn1pFilter("any");
                    setRenewSoon(false);
                  }}
                >
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body — grouped sections */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            No subscriptions match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ key, items }) => (
            <section key={key} className="space-y-3">
              {groupBy !== "none" && (
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {key}
                  </h2>
                  <span className="text-xs text-zinc-400">{items.length}</span>
                </div>
              )}
              {view === "table" && (
                <TableView
                  items={flattenWithChildren(items, childrenByParent)}
                  editMode={editMode}
                  onRowClick={(r) => setEditing(r)}
                  onArchive={handleArchive}
                  onAddCredential={openAddCredential}
                />
              )}
              {view === "cards" && (
                <CardsView
                  items={flattenWithChildren(items, childrenByParent)}
                  editMode={editMode}
                  onRowClick={(r) => setEditing(r)}
                />
              )}
              {view === "compact" && (
                <CompactView
                  items={flattenWithChildren(items, childrenByParent)}
                  editMode={editMode}
                  onRowClick={(r) => setEditing(r)}
                />
              )}
            </section>
          ))}
        </div>
      )}

      <EditSubscriptionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={editing ?? undefined}
        onSaved={handleSaved}
        knownDepartments={allDepartments}
        knownStatuses={allStatuses}
        possibleParents={topLevelRows}
        readOnly={!editMode}
      />
      <EditSubscriptionDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setAddParentId("");
        }}
        onCreated={handleCreated}
        knownDepartments={allDepartments}
        knownStatuses={allStatuses}
        possibleParents={topLevelRows}
        initialParentId={addParentId || undefined}
      />
    </div>
  );
}

const SORT_LABEL: Record<SortKey, string> = {
  name: "Name A–Z",
  monthlyDesc: "Monthly ↓",
  monthlyAsc: "Monthly ↑",
  annualDesc: "Annual ↓",
  renewalSoonest: "Renewal soonest",
  renewalLatest: "Renewal latest",
};

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            highlight && "text-amber-700",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition",
        active && "bg-zinc-100 text-zinc-900",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        statusTone(status),
      )}
    >
      {status}
    </span>
  );
}

function RenewalCell({
  date,
  dayOfMonth,
  annual = false,
}: {
  date: string | null;
  dayOfMonth?: number | null;
  annual?: boolean;
}) {
  const { text, daysOut, monthly } = fmtRenewal(date, dayOfMonth ?? null, annual);
  const tone =
    daysOut == null
      ? "text-zinc-400"
      : daysOut < 0
      ? "text-zinc-400 line-through"
      : daysOut <= 30
      ? "text-amber-700 font-medium"
      : "text-zinc-700";
  return (
    <span className={cn("text-xs", tone)} title={monthly && daysOut != null ? `Next: in ${daysOut}d` : undefined}>
      {text}
    </span>
  );
}

function TableView({
  items,
  editMode,
  onRowClick,
  onArchive,
  onAddCredential,
}: {
  items: DisplayRow[];
  editMode: boolean;
  onRowClick: (r: SubscriptionRow) => void;
  onArchive: (r: SubscriptionRow) => void;
  onAddCredential: (r: SubscriptionRow) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="text-left px-3 py-2 w-6"></th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Owner</th>
              <th className="text-left px-3 py-2">Departments</th>
              <th className="text-right px-3 py-2">Monthly</th>
              <th className="text-right px-3 py-2">Annual</th>
              <th className="text-left px-3 py-2">Renewal</th>
              <th className="text-center px-3 py-2">1P</th>
              <th className="text-left px-3 py-2">Status</th>
              {editMode && <th className="w-16 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick(r)}
                className={cn(
                  "cursor-pointer border-t hover:bg-zinc-50",
                  r._isChild && "bg-zinc-50/40",
                )}
              >
                <td className="px-3 py-2 align-top">
                  {r._isChild ? (
                    <span className="ml-2 text-zinc-300 select-none">↳</span>
                  ) : r.isStarred ? (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                  ) : null}
                </td>
                <td className={cn("px-3 py-2 align-top", r._isChild && "pl-6")}>
                  {r._isChild ? (
                    // Nested credential/seat: show its custom label, or nothing
                    // (blank) — never the redundant parent app name. The owner
                    // column identifies the row.
                    r.label ? (
                      <div className="text-xs text-zinc-600">{r.label}</div>
                    ) : null
                  ) : (
                    <div className="font-medium text-zinc-900">
                      {r.serviceName || r.name}
                    </div>
                  )}
                  {r.websiteUrl &&
                    (() => {
                      const host = safeHost(r.websiteUrl);
                      if (!host) return null;
                      return (
                        <a
                          href={r.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {host}
                        </a>
                      );
                    })()}
                </td>
                <td className="px-3 py-2 align-top text-xs font-mono text-zinc-600 max-w-[200px] truncate">
                  {r.ownerEmail || <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap gap-1">
                    {r.departments.slice(0, 3).map((d) => (
                      <DeptBadge key={d} name={d} />
                    ))}
                    {r.departments.length > 3 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        +{r.departments.length - 3}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {fmtUsd(r.monthlyCostUsd)}
                  {r.seats != null && r.perSeatCostUsd != null && (
                    <div className="text-[10px] font-normal text-zinc-400">
                      {r.seats} × {fmtUsd(r.perSeatCostUsd)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums text-zinc-600">{fmtUsd(r.annualCostUsd)}</td>
                <td className="px-3 py-2 align-top"><RenewalCell date={r.renewalDate} dayOfMonth={r.renewalDayOfMonth} annual={isAnnualBilled(r)} /></td>
                <td className="px-3 py-2 align-top text-center">
                  {r.inOnePassword ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top"><StatusBadge status={r.status} /></td>
                {editMode && (
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center justify-end gap-0.5">
                      {!r._isChild && (
                        <button
                          type="button"
                          title="Add a credential / seat under this subscription"
                          aria-label="Add credential"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddCredential(r);
                          }}
                          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Archive"
                        aria-label="Archive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(r);
                        }}
                        className="rounded p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CardsView({
  items,
  onRowClick,
}: {
  items: DisplayRow[];
  editMode: boolean;
  onRowClick: (r: SubscriptionRow) => void;
}) {
  // In the card view children are collapsed into the parent card as a
  // small "Seats" chip list — cleaner than rendering 7 separate cards
  // for the same Claude team plan.
  const parentItems = items.filter((r) => !r._isChild);
  const childrenByParent = new Map<string, SubscriptionRow[]>();
  for (const r of items) {
    if (r._isChild && r.parentId) {
      const arr = childrenByParent.get(r.parentId) || [];
      arr.push(r);
      childrenByParent.set(r.parentId, arr);
    }
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {parentItems.map((r) => (
        <Card
          key={r.id}
          onClick={() => onRowClick(r)}
          className="cursor-pointer hover:shadow-md transition"
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {r.isStarred && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                  )}
                  <h3 className="font-medium truncate">{r.serviceName || r.name}</h3>
                </div>
                {r.ownerEmail && (
                  <div className="mt-0.5 text-xs font-mono text-zinc-500 truncate">
                    {r.ownerEmail}
                  </div>
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Monthly</div>
                <div className="text-lg font-semibold tabular-nums">{fmtUsd(r.monthlyCostUsd)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Annual</div>
                <div className="text-sm tabular-nums text-zinc-600">{fmtUsd(r.annualCostUsd)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.departments.slice(0, 5).map((d) => (
                <DeptBadge key={d} name={d} />
              ))}
            </div>
            {(() => {
              const kids = childrenByParent.get(r.id) || [];
              if (kids.length === 0) return null;
              return (
                <div className="space-y-1 border-t pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {kids.length} seat{kids.length === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {kids.slice(0, 8).map((k) => (
                      <span
                        key={k.id}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-600"
                      >
                        {k.label || k.ownerEmail?.split("@")[0] || "seat"}
                      </span>
                    ))}
                    {kids.length > 8 && (
                      <span className="text-[10px] text-zinc-400">+{kids.length - 8} more</span>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t">
              <RenewalCell date={r.renewalDate} dayOfMonth={r.renewalDayOfMonth} annual={isAnnualBilled(r)} />
              {r.inOnePassword && <span className="text-emerald-600">1P ✓</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompactView({
  items,
  onRowClick,
}: {
  items: DisplayRow[];
  editMode: boolean;
  onRowClick: (r: SubscriptionRow) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((r) => (
            <li
              key={r.id}
              onClick={() => onRowClick(r)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50",
                r._isChild && "pl-8 bg-zinc-50/30",
              )}
            >
              {r._isChild ? (
                <span className="w-3.5 shrink-0 text-zinc-300 text-xs select-none">↳</span>
              ) : r.isStarred ? (
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {r._isChild
                    ? r.label || r.ownerEmail?.split("@")[0] || "—"
                    : r.serviceName || r.name}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {r.ownerEmail || r.departments.join(", ") || "—"}
                </div>
              </div>
              <div className="text-xs tabular-nums text-zinc-700">{fmtUsd(r.monthlyCostUsd)}/mo</div>
              <RenewalCell date={r.renewalDate} dayOfMonth={r.renewalDayOfMonth} annual={isAnnualBilled(r)} />
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

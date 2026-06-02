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

export interface SubscriptionRow {
  id: string;
  externalId: string | null;
  name: string;
  serviceName: string | null;
  ownerEmail: string | null;
  isStarred: boolean;
  websiteUrl: string | null;
  departments: string[];
  inOnePassword: boolean;
  monthlyCostUsd: number | null;
  annualCostUsd: number | null;
  renewalDate: string | null;
  notes: string | null;
  tag: string | null;
  status: string;
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

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  cancelled: "bg-zinc-200 text-zinc-700",
  archived: "bg-zinc-100 text-zinc-500",
};

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtRenewal(d: string | null): {
  text: string;
  daysOut: number | null;
} {
  if (!d) return { text: "—", daysOut: null };
  const parsed = parseISO(d);
  if (!dateIsValid(parsed)) return { text: d, daysOut: null };
  const days = differenceInDays(parsed, new Date());
  return { text: format(parsed, "MMM d, yyyy"), daysOut: days };
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

  // Derive the universe of departments for the filter dropdown
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const d of r.departments) set.add(d);
    return Array.from(set).sort();
  }, [rows]);

  // Apply filters + search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (in1pFilter === "yes" && !r.inOnePassword) return false;
      if (in1pFilter === "no" && r.inOnePassword) return false;
      if (renewSoon) {
        const { daysOut } = fmtRenewal(r.renewalDate);
        if (daysOut == null || daysOut < 0 || daysOut > 30) return false;
      }
      if (deptFilter.size > 0) {
        const hit = r.departments.some((d) => deptFilter.has(d));
        if (!hit) return false;
      }
      if (q) {
        const haystack = [
          r.name,
          r.serviceName,
          r.ownerEmail,
          r.notes,
          r.tag,
          ...r.departments,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, in1pFilter, renewSoon, deptFilter]);

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
        if (!r.renewalDate) keys = ["(no renewal date)"];
        else {
          const dt = parseISO(r.renewalDate);
          keys = [dateIsValid(dt) ? format(dt, "MMM yyyy") : "(unknown)"];
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
      const { daysOut } = fmtRenewal(r.renewalDate);
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
    toast.success(`Added ${created.name}`);
  };
  const handleArchive = async (row: SubscriptionRow) => {
    if (!confirm(`Archive "${row.name}"?`)) return;
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
    for (const r of sorted) {
      lines.push(
        [
          r.name,
          r.serviceName,
          r.ownerEmail,
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
          {editMode && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add
            </Button>
          )}
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
            <DropdownMenuItem onSelect={() => setStatusFilter("all")}>{statusFilter === "all" ? "✓ " : "  "}All</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusFilter("active")}>{statusFilter === "active" ? "✓ " : "  "}Active</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusFilter("cancelled")}>{statusFilter === "cancelled" ? "✓ " : "  "}Cancelled</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusFilter("paused")}>{statusFilter === "paused" ? "✓ " : "  "}Paused</DropdownMenuItem>
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
                <TableView items={items} editMode={editMode} onRowClick={(r) => setEditing(r)} onArchive={handleArchive} />
              )}
              {view === "cards" && (
                <CardsView items={items} editMode={editMode} onRowClick={(r) => setEditing(r)} />
              )}
              {view === "compact" && (
                <CompactView items={items} editMode={editMode} onRowClick={(r) => setEditing(r)} />
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
        readOnly={!editMode}
      />
      <EditSubscriptionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        knownDepartments={allDepartments}
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
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_TONE[status] || STATUS_TONE.archived,
      )}
    >
      {status}
    </span>
  );
}

function RenewalCell({ date }: { date: string | null }) {
  const { text, daysOut } = fmtRenewal(date);
  const tone =
    daysOut == null
      ? "text-zinc-400"
      : daysOut < 0
      ? "text-zinc-400 line-through"
      : daysOut <= 30
      ? "text-amber-700 font-medium"
      : "text-zinc-700";
  return <span className={cn("text-xs", tone)}>{text}</span>;
}

function TableView({
  items,
  editMode,
  onRowClick,
  onArchive,
}: {
  items: SubscriptionRow[];
  editMode: boolean;
  onRowClick: (r: SubscriptionRow) => void;
  onArchive: (r: SubscriptionRow) => void;
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
              {editMode && <th className="w-10 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick(r)}
                className="cursor-pointer border-t hover:bg-zinc-50"
              >
                <td className="px-3 py-2 align-top">
                  {r.isStarred && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-zinc-900">{r.serviceName || r.name}</div>
                  {r.websiteUrl && (
                    <a
                      href={r.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {new URL(r.websiteUrl).hostname.replace(/^www\./, "")}
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-xs font-mono text-zinc-600 max-w-[200px] truncate">
                  {r.ownerEmail || <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap gap-1">
                    {r.departments.slice(0, 3).map((d) => (
                      <Badge key={d} variant="secondary" className="text-[10px] font-normal">
                        {d}
                      </Badge>
                    ))}
                    {r.departments.length > 3 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        +{r.departments.length - 3}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{fmtUsd(r.monthlyCostUsd)}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums text-zinc-600">{fmtUsd(r.annualCostUsd)}</td>
                <td className="px-3 py-2 align-top"><RenewalCell date={r.renewalDate} /></td>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(r);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Archive
                    </button>
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
  items: SubscriptionRow[];
  editMode: boolean;
  onRowClick: (r: SubscriptionRow) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
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
                <Badge key={d} variant="secondary" className="text-[10px] font-normal">{d}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t">
              <RenewalCell date={r.renewalDate} />
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
  items: SubscriptionRow[];
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
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50"
            >
              {r.isStarred ? (
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.serviceName || r.name}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {r.ownerEmail || r.departments.join(", ") || "—"}
                </div>
              </div>
              <div className="text-xs tabular-nums text-zinc-700">{fmtUsd(r.monthlyCostUsd)}/mo</div>
              <RenewalCell date={r.renewalDate} />
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

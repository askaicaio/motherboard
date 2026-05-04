"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Archive,
  ArchiveRestore,
  Shield,
  User as UserIcon,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  UserMinus,
  UserCog,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DEPARTMENTS_LIST,
  departmentLabel,
  isAdminRole,
  memberRoleFromAdminRole,
  type Department,
} from "@/types";
import { toast } from "sonner";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRowActions } from "./member-row-actions";
import { MemberDetailDialog } from "./member-detail-dialog";
import {
  GROUP_OPTIONS,
  SORT_OPTIONS,
  COLUMN_DEFINITIONS,
  type ColumnKey,
  type GroupKey,
  type Member,
  type SortKey,
} from "./member-types";

interface Props {
  initialMembers: Member[];
  archivedCount: number;
  showArchived: boolean;
  currentUserId: string;
  canManage: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function statusBadge(member: Member): { label: string; cls: string } {
  if (member.archivedAt) return { label: "Archived", cls: "bg-zinc-100 text-zinc-600" };
  if (!member.isActive) return { label: "Deactivated", cls: "bg-amber-100 text-amber-800" };
  if (member.lastLoginAt) return { label: "Active", cls: "bg-emerald-100 text-emerald-800" };
  if (member.invitedAt) return { label: "Invited", cls: "bg-blue-100 text-blue-800" };
  return { label: "Active", cls: "bg-emerald-100 text-emerald-800" };
}

function sortMembers(members: Member[], key: SortKey): Member[] {
  const sorted = [...members];
  switch (key) {
    case "name_asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "started_asc":
      return sorted.sort((a, b) => {
        const da = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const db_ = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return da - db_;
      });
    case "started_desc":
      return sorted.sort((a, b) => {
        const da = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const db_ = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return db_ - da;
      });
    case "created_asc":
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "created_desc":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

function groupMembers(
  members: Member[],
  group: GroupKey,
): Map<string, Member[]> {
  if (group === "none") return new Map([["__all__", members]]);
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    const key =
      group === "role"
        ? memberRoleFromAdminRole(m.role) === "admin"
          ? "Admin"
          : "User"
        : departmentLabel(m.department);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return groups;
}

const COLUMN_STORAGE_KEY = "members-columns";

function loadColumnPrefs(): Set<ColumnKey> {
  if (typeof window === "undefined") {
    return new Set(COLUMN_DEFINITIONS.filter((c) => c.default).map((c) => c.key));
  }
  const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
  if (stored) {
    try {
      const arr = JSON.parse(stored) as ColumnKey[];
      return new Set(arr);
    } catch {
      /* fall through */
    }
  }
  return new Set(COLUMN_DEFINITIONS.filter((c) => c.default).map((c) => c.key));
}

export function MembersPageClient({
  initialMembers,
  archivedCount,
  showArchived,
  currentUserId,
  canManage,
}: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("name_asc");
  const [group, setGroup] = useState<GroupKey>("none");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFINITIONS.filter((c) => c.default).map((c) => c.key)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Hydrate prefs from localStorage on first client render
  useEffect(() => {
    setSort((localStorage.getItem("members-sort") as SortKey) || "name_asc");
    setGroup((localStorage.getItem("members-group") as GroupKey) || "none");
    setVisibleColumns(loadColumnPrefs());
  }, []);

  function setSortAndPersist(value: SortKey) {
    setSort(value);
    if (typeof window !== "undefined") localStorage.setItem("members-sort", value);
  }

  function setGroupAndPersist(value: GroupKey) {
    setGroup(value);
    if (typeof window !== "undefined") localStorage.setItem("members-group", value);
  }

  function toggleColumn(key: ColumnKey) {
    const next = new Set(visibleColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size === 0) return; // never hide all columns
    setVisibleColumns(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...next]));
    }
  }

  const sorted = useMemo(() => sortMembers(initialMembers, sort), [initialMembers, sort]);
  const grouped = useMemo(() => groupMembers(sorted, group), [sorted, group]);

  function toggleArchived(showArchivedNow: boolean) {
    router.push(showArchivedNow ? "/members?archived=1" : "/members");
  }

  // ---- Selection helpers ----
  const selectableIds = useMemo(
    () => sorted.filter((m) => m.id !== currentUserId).map((m) => m.id),
    [sorted, currentUserId],
  );
  const allSelected =
    selected.size > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function toggleOne(id: string) {
    if (id === currentUserId) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // ---- Bulk actions ----
  async function bulkAction(payload: {
    action: string;
    role?: "admin" | "user";
    department?: Department;
    confirmMsg?: string;
  }) {
    if (selected.size === 0) return;
    if (payload.confirmMsg && !confirm(payload.confirmMsg)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          action: payload.action,
          role: payload.role,
          department: payload.department,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(`${data.affected} member${data.affected === 1 ? "" : "s"} updated`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {showArchived ? "Archived Members" : "Members"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {showArchived
              ? "Restore archived members or permanently delete them. Archived members are also where offboarded team members live."
              : "Everyone with access to Motherboard — including team members onboarded through the Onboarding workflow. Admins can invite, edit roles, deactivate, or archive."}
          </p>
        </div>

        {!showArchived && canManage && <InviteMemberDialog />}

        {showArchived && (
          <Button variant="ghost" onClick={() => toggleArchived(false)} className="gap-2">
            <ArchiveRestore className="h-4 w-4" />
            Back to active
          </Button>
        )}
      </div>

      {/* Toolbar */}
      {initialMembers.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-zinc-500">
            {someSelected ? (
              <span className="font-medium text-zinc-900">
                {selected.size} selected
              </span>
            ) : (
              <>
                {initialMembers.length} {initialMembers.length === 1 ? "member" : "members"}
                {showArchived && " in archive"}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk actions */}
            {someSelected && canManage && (
              <BulkActionsMenu
                count={selected.size}
                onAction={bulkAction}
                busy={bulkBusy}
                showArchived={showArchived}
              />
            )}

            <select
              value={sort}
              onChange={(e) => setSortAndPersist(e.target.value as SortKey)}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs shadow-sm focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
            <select
              value={group}
              onChange={(e) => setGroupAndPersist(e.target.value as GroupKey)}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs shadow-sm focus:outline-none"
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Column customizer */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                  Show columns
                </div>
                <DropdownMenuSeparator />
                {COLUMN_DEFINITIONS.map((col) => (
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
        </div>
      )}

      {/* Empty state */}
      {initialMembers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-zinc-300" />
            <h3 className="mt-4 text-base font-medium text-zinc-900">
              {showArchived ? "No archived members" : "No members yet"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
              {showArchived
                ? "Archive members from the active list to keep your team roster tidy."
                : "Invite team members to give them access to Motherboard."}
            </p>
            {showArchived ? (
              <Button className="mt-6 gap-2" variant="outline" onClick={() => toggleArchived(false)}>
                <ArchiveRestore className="h-4 w-4" />
                Back to active
              </Button>
            ) : (
              canManage && <div className="mt-6 inline-block"><InviteMemberDialog /></div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="pl-6 w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {visibleColumns.has("name") && (
                  <TableHead className={canManage ? "" : "pl-6"}>Name</TableHead>
                )}
                {visibleColumns.has("role") && <TableHead>Role</TableHead>}
                {visibleColumns.has("department") && <TableHead>Department</TableHead>}
                {visibleColumns.has("jobTitle") && <TableHead>Job Title</TableHead>}
                {visibleColumns.has("location") && <TableHead>Location</TableHead>}
                {visibleColumns.has("phone") && <TableHead>Phone</TableHead>}
                {visibleColumns.has("status") && <TableHead>Status</TableHead>}
                {visibleColumns.has("started") && <TableHead>Started</TableHead>}
                {visibleColumns.has("invited") && <TableHead>Invited</TableHead>}
                {visibleColumns.has("lastLogin") && <TableHead>Last login</TableHead>}
                {visibleColumns.has("createdAt") && <TableHead>Date Added</TableHead>}
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...grouped.entries()].map(([groupName, members]) => (
                <MemberGroup
                  key={groupName}
                  groupName={group === "none" ? null : groupName}
                  members={members}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  visibleColumns={visibleColumns}
                  selected={selected}
                  onToggleSelect={toggleOne}
                  onRowClick={setDetailMember}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Footer: archived toggle */}
      {!showArchived && archivedCount > 0 && (
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-center">
          <button
            onClick={() => toggleArchived(true)}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            View {archivedCount} archived member{archivedCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Detail dialog */}
      <MemberDetailDialog
        member={detailMember}
        open={!!detailMember}
        onOpenChange={(open) => !open && setDetailMember(null)}
        canManage={canManage}
      />
    </div>
  );
}

function MemberGroup({
  groupName,
  members,
  currentUserId,
  canManage,
  visibleColumns,
  selected,
  onToggleSelect,
  onRowClick,
}: {
  groupName: string | null;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  visibleColumns: Set<ColumnKey>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onRowClick: (m: Member) => void;
}) {
  // Compute total cell count for groupName row span
  const totalCols =
    (canManage ? 1 : 0) + // checkbox column
    [...visibleColumns].length + // visible data columns
    1; // actions column

  return (
    <>
      {groupName && (
        <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70">
          <TableCell colSpan={totalCols} className="pl-6 py-2">
            <div className="text-[11px] uppercase tracking-wider font-medium text-zinc-600">
              {groupName} · {members.length}
            </div>
          </TableCell>
        </TableRow>
      )}
      {members.map((member) => {
        const status = statusBadge(member);
        const isAdmin = isAdminRole(member.role);
        const memberRole = memberRoleFromAdminRole(member.role);
        const isSelf = member.id === currentUserId;
        const isSelected = selected.has(member.id);

        return (
          <TableRow
            key={member.id}
            className={cn(
              !member.isActive && "opacity-60",
              "cursor-pointer hover:bg-zinc-50/80",
              isSelected && "bg-indigo-50/40 hover:bg-indigo-50/50",
            )}
            onClick={() => onRowClick(member)}
          >
            {canManage && (
              <TableCell
                className="pl-6 w-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(member.id)}
                  disabled={isSelf}
                  aria-label={`Select ${member.name}`}
                />
              </TableCell>
            )}
            {visibleColumns.has("name") && (
              <TableCell className={canManage ? "py-3" : "pl-6 py-3"}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                    <AvatarFallback className="text-[11px] bg-zinc-100">
                      {initials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{member.name}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate">
                      {member.email}
                    </div>
                  </div>
                </div>
              </TableCell>
            )}
            {visibleColumns.has("role") && (
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {isAdmin ? (
                    <Shield className="h-3.5 w-3.5 text-purple-500" />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                  <span className="text-sm capitalize">{memberRole}</span>
                </div>
              </TableCell>
            )}
            {visibleColumns.has("department") && (
              <TableCell className="text-sm text-zinc-700">
                {departmentLabel(member.department)}
              </TableCell>
            )}
            {visibleColumns.has("jobTitle") && (
              <TableCell className="text-sm text-zinc-700">
                {member.jobTitle || <span className="italic text-zinc-400">—</span>}
              </TableCell>
            )}
            {visibleColumns.has("location") && (
              <TableCell className="text-sm text-zinc-700">
                {member.location || <span className="italic text-zinc-400">—</span>}
              </TableCell>
            )}
            {visibleColumns.has("phone") && (
              <TableCell className="text-sm text-zinc-700">
                {member.phone || <span className="italic text-zinc-400">—</span>}
              </TableCell>
            )}
            {visibleColumns.has("status") && (
              <TableCell>
                <Badge className={status.cls}>{status.label}</Badge>
              </TableCell>
            )}
            {visibleColumns.has("started") && (
              <TableCell className="text-sm text-zinc-500">
                {member.startedAt
                  ? format(new Date(member.startedAt), "MMM d, yyyy")
                  : <span className="italic">—</span>}
              </TableCell>
            )}
            {visibleColumns.has("invited") && (
              <TableCell className="text-sm text-zinc-500">
                {member.invitedAt
                  ? format(new Date(member.invitedAt), "MMM d, yyyy")
                  : <span className="italic">—</span>}
              </TableCell>
            )}
            {visibleColumns.has("lastLogin") && (
              <TableCell className="text-sm text-zinc-500">
                {member.lastLoginAt
                  ? format(new Date(member.lastLoginAt), "MMM d, yyyy")
                  : <span className="italic">never</span>}
              </TableCell>
            )}
            {visibleColumns.has("createdAt") && (
              <TableCell className="text-sm text-zinc-500">
                {format(new Date(member.createdAt), "MMM d, yyyy")}
              </TableCell>
            )}
            <TableCell
              className="text-right pr-4"
              onClick={(e) => e.stopPropagation()}
            >
              <MemberRowActions
                member={member}
                canManage={canManage}
                isSelf={isSelf}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function BulkActionsMenu({
  count,
  onAction,
  busy,
  showArchived,
}: {
  count: number;
  onAction: (payload: {
    action: string;
    role?: "admin" | "user";
    department?: Department;
    confirmMsg?: string;
  }) => void;
  busy: boolean;
  showArchived: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          disabled={busy}
        >
          Bulk actions ({count})
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Role */}
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
          Set role
        </div>
        <DropdownMenuItem
          onSelect={() => onAction({ action: "update_role", role: "admin" })}
        >
          <Shield className="h-3.5 w-3.5 mr-2 text-purple-500" />
          Make Admin
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onAction({ action: "update_role", role: "user" })}
        >
          <UserIcon className="h-3.5 w-3.5 mr-2 text-zinc-500" />
          Make User
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Department */}
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
          Set department
        </div>
        {DEPARTMENTS_LIST.map((d) => (
          <DropdownMenuItem
            key={d.value}
            onSelect={() =>
              onAction({
                action: "update_department",
                department: d.value as Department,
              })
            }
          >
            <Building2 className="h-3.5 w-3.5 mr-2 text-zinc-400" />
            {d.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Lifecycle */}
        {!showArchived && (
          <>
            <DropdownMenuItem
              onSelect={() =>
                onAction({
                  action: "deactivate",
                  confirmMsg: `Deactivate ${count} member(s)? They will lose access until reactivated.`,
                })
              }
            >
              <UserMinus className="h-3.5 w-3.5 mr-2 text-amber-600" />
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onAction({
                  action: "archive",
                  confirmMsg: `Archive ${count} member(s)? They'll be moved to the archive list.`,
                })
              }
            >
              <Archive className="h-3.5 w-3.5 mr-2 text-zinc-500" />
              Archive
            </DropdownMenuItem>
          </>
        )}
        {showArchived && (
          <DropdownMenuItem
            onSelect={() => onAction({ action: "unarchive" })}
          >
            <ArchiveRestore className="h-3.5 w-3.5 mr-2 text-zinc-500" />
            Restore from archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export Link for backwards compat with existing imports
export { default as Link } from "next/link";

// Suppress unused-warnings for kept imports referenced in JSX above
void UserCog;

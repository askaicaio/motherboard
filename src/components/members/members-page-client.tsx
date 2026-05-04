"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Users,
  Archive,
  ArchiveRestore,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  departmentLabel,
  isAdminRole,
  memberRoleFromAdminRole,
} from "@/types";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRowActions } from "./member-row-actions";
import {
  GROUP_OPTIONS,
  SORT_OPTIONS,
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
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "created_desc":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    default:
      return sorted;
  }
}

function groupMembers(members: Member[], key: GroupKey): Map<string, Member[]> {
  const groups = new Map<string, Member[]>();
  if (key === "none") {
    groups.set("All members", members);
    return groups;
  }
  for (const m of members) {
    let groupKey: string;
    if (key === "role") {
      groupKey = isAdminRole(m.role) ? "Admins" : "Users";
    } else {
      groupKey = departmentLabel(m.department);
    }
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(m);
  }
  // Sort group keys alphabetically (with "Admins" first when grouping by role)
  return new Map(
    [...groups.entries()].sort(([a], [b]) => {
      if (key === "role") {
        if (a === "Admins") return -1;
        if (b === "Admins") return 1;
      }
      return a.localeCompare(b);
    }),
  );
}

export function MembersPageClient({
  initialMembers,
  archivedCount,
  showArchived,
  currentUserId,
  canManage,
}: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "name_asc";
    return (localStorage.getItem("members-sort") as SortKey) || "name_asc";
  });
  const [group, setGroup] = useState<GroupKey>(() => {
    if (typeof window === "undefined") return "none";
    return (localStorage.getItem("members-group") as GroupKey) || "none";
  });

  function setSortAndPersist(value: SortKey) {
    setSort(value);
    if (typeof window !== "undefined") localStorage.setItem("members-sort", value);
  }

  function setGroupAndPersist(value: GroupKey) {
    setGroup(value);
    if (typeof window !== "undefined") localStorage.setItem("members-group", value);
  }

  const grouped = useMemo(() => {
    const sorted = sortMembers(initialMembers, sort);
    return groupMembers(sorted, group);
  }, [initialMembers, sort, group]);

  function toggleArchived(showArchivedNow: boolean) {
    router.push(showArchivedNow ? "/members?archived=1" : "/members");
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
              ? "Restore archived members or permanently delete them."
              : "Team members with access to Motherboard. Admins can invite, edit roles, and deactivate."}
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
            {initialMembers.length} {initialMembers.length === 1 ? "member" : "members"}
            {showArchived && " in archive"}
          </div>

          <div className="flex items-center gap-2">
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
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Last login</TableHead>
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
    </div>
  );
}

function MemberGroup({
  groupName,
  members,
  currentUserId,
  canManage,
}: {
  groupName: string | null;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
}) {
  return (
    <>
      {groupName && (
        <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70">
          <TableCell colSpan={7} className="pl-6 py-2">
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
        return (
          <TableRow key={member.id} className={cn(!member.isActive && "opacity-60")}>
            <TableCell className="pl-6 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={undefined} alt={member.name} />
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
            <TableCell className="text-sm text-zinc-700">
              {departmentLabel(member.department)}
            </TableCell>
            <TableCell>
              <Badge className={status.cls}>{status.label}</Badge>
            </TableCell>
            <TableCell className="text-sm text-zinc-500">
              {member.startedAt ? format(new Date(member.startedAt), "MMM d, yyyy") : "—"}
            </TableCell>
            <TableCell className="text-sm text-zinc-500">
              {member.lastLoginAt
                ? format(new Date(member.lastLoginAt), "MMM d, yyyy")
                : <span className="italic">never</span>}
            </TableCell>
            <TableCell className="text-right pr-4">
              <MemberRowActions
                member={member}
                canManage={canManage}
                isSelf={member.id === currentUserId}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

export { Link };

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  UserCog,
  UserMinus,
  UserCheck,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EditMemberDialog } from "./edit-member-dialog";
import type { Member } from "./member-types";

interface Props {
  member: Member;
  /** True if the current viewer is an admin */
  canManage: boolean;
  /** True if this row is the current viewer (prevent self-modification) */
  isSelf: boolean;
}

export function MemberRowActions({ member, canManage, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isArchived = !!member.archivedAt;

  async function lifecycle(action: "deactivate" | "reactivate" | "archive" | "unarchive") {
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${member.id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const messages: Record<typeof action, string> = {
        deactivate: `${member.name} deactivated`,
        reactivate: `${member.name} reactivated`,
        archive: `${member.name} archived`,
        unarchive: `${member.name} restored from archive`,
      };
      toast.success(messages[action]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function permanentDelete() {
    if (
      !confirm(
        `PERMANENTLY DELETE ${member.name} (${member.email})?\n\nThis removes the database record entirely. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(`${member.name} permanently deleted`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return null; // Non-admin viewers see no actions menu
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={busy}
            aria-label="Member actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isArchived && (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)} disabled={isSelf}>
                <UserCog className="h-3.5 w-3.5 mr-2" />
                Edit role / department
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {!isArchived && member.isActive && (
            <DropdownMenuItem
              onSelect={() => lifecycle("deactivate")}
              disabled={isSelf}
            >
              <UserMinus className="h-3.5 w-3.5 mr-2" />
              Deactivate
            </DropdownMenuItem>
          )}

          {!isArchived && !member.isActive && (
            <>
              <DropdownMenuItem
                onSelect={() => lifecycle("reactivate")}
                disabled={isSelf}
              >
                <UserCheck className="h-3.5 w-3.5 mr-2" />
                Reactivate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => lifecycle("archive")}
                disabled={isSelf}
              >
                <Archive className="h-3.5 w-3.5 mr-2" />
                Archive
              </DropdownMenuItem>
            </>
          )}

          {isArchived && (
            <>
              <DropdownMenuItem
                onSelect={() => lifecycle("unarchive")}
                disabled={isSelf}
              >
                <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
                Restore from archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={permanentDelete}
                disabled={isSelf}
                className="text-red-600 focus:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete permanently
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog
        member={member}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

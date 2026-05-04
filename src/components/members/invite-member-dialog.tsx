"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS_LIST, type Department, type MemberRole } from "@/types";

interface Props {
  trigger?: React.ReactNode;
}

export function InviteMemberDialog({ trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("user");
  const [department, setDepartment] = useState<Department>("unassigned");
  const [startedAt, setStartedAt] = useState("");

  function reset() {
    setEmail("");
    setName("");
    setRole("user");
    setDepartment("unassigned");
    setStartedAt("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error("Email and name are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          department,
          startedAt: startedAt || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(`${name} invited`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-purple-500" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            They&apos;ll be able to sign in immediately with their{" "}
            <span className="font-mono text-zinc-700">@chiefaiofficer.com</span>{" "}
            Google account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@chiefaiofficer.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-zinc-900 focus:outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-dept">Department</Label>
              <select
                id="invite-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-zinc-900 focus:outline-none"
              >
                {DEPARTMENTS_LIST.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-started">Start date</Label>
            <Input
              id="invite-started"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Optional. When the member started/will start at the company.
            </p>
          </div>

          <div className="rounded-md bg-purple-50 border border-purple-100 p-3 text-xs text-purple-900">
            {role === "admin" ? (
              <>
                <strong>Admin</strong> can invite/manage members, change roles,
                and access all areas.
              </>
            ) : (
              <>
                <strong>User</strong> has standard access. Sales department users
                also see Company Reports.
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

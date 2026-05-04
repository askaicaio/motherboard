"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS_LIST, memberRoleFromAdminRole, type Department, type MemberRole } from "@/types";
import type { Member } from "./member-types";

interface Props {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMemberDialog({ member, open, onOpenChange }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<MemberRole>(memberRoleFromAdminRole(member.role));
  const [department, setDepartment] = useState<Department>(
    (member.department as Department) || "unassigned",
  );
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [location, setLocation] = useState(member.location ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [startedAt, setStartedAt] = useState(
    member.startedAt
      ? new Date(member.startedAt).toISOString().slice(0, 10)
      : "",
  );

  // Reset form values when the member prop changes (different row clicked)
  useEffect(() => {
    if (open) {
      setName(member.name);
      setRole(memberRoleFromAdminRole(member.role));
      setDepartment((member.department as Department) || "unassigned");
      setJobTitle(member.jobTitle ?? "");
      setLocation(member.location ?? "");
      setPhone(member.phone ?? "");
      setBio(member.bio ?? "");
      setStartedAt(
        member.startedAt
          ? new Date(member.startedAt).toISOString().slice(0, 10)
          : "",
      );
    }
  }, [open, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          department,
          jobTitle: jobTitle.trim() || null,
          location: location.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          startedAt: startedAt || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(`${name} updated`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4 text-purple-500" />
            Edit Member
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs text-zinc-700">{member.email}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-zinc-900 focus:outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept">Department</Label>
              <select
                id="edit-dept"
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
            <Label htmlFor="edit-job-title">Job title (Company Role)</Label>
            <Input
              id="edit-job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Account Manager"
            />
            <p className="text-[11px] text-zinc-500">
              The member&apos;s title within the company. Distinct from the
              platform Role above.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote — Austin, TX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555-123-4567"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-started">Start date</Label>
            <Input
              id="edit-started"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-bio">Bio (optional)</Label>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Short bio — what they do, focus areas, etc."
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

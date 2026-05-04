"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Clock,
  Shield,
  User as UserIcon,
  UserCog,
  Building2,
  Hash,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { departmentLabel, isAdminRole } from "@/types";
import { EditMemberDialog } from "./edit-member-dialog";
import type { Member } from "./member-types";

interface Props {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True if the current viewer can edit this member */
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

export function MemberDetailDialog({ member, open, onOpenChange, canManage }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  if (!member) return null;

  const isAdmin = isAdminRole(member.role);
  const status = member.archivedAt
    ? { label: "Archived", cls: "bg-zinc-100 text-zinc-700" }
    : !member.isActive
      ? { label: "Deactivated", cls: "bg-amber-100 text-amber-800" }
      : member.lastLoginAt
        ? { label: "Active", cls: "bg-emerald-100 text-emerald-800" }
        : member.invitedAt
          ? { label: "Invited", cls: "bg-blue-100 text-blue-800" }
          : { label: "Active", cls: "bg-emerald-100 text-emerald-800" };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-zinc-50 to-white px-6 pt-6 pb-5 border-b border-zinc-100">
            <DialogHeader>
              <DialogTitle className="sr-only">{member.name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border border-zinc-200">
                  <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                  <AvatarFallback className="text-lg bg-zinc-100 text-zinc-700">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-medium tracking-tight text-zinc-900">
                      {member.name}
                    </h2>
                    <Badge className={status.cls}>{status.label}</Badge>
                  </div>
                  {member.jobTitle && (
                    <div className="text-sm text-zinc-700 font-medium">
                      {member.jobTitle}
                    </div>
                  )}
                  <div className="text-sm text-zinc-500 font-mono">{member.email}</div>
                </div>
              </div>
              {canManage && !member.archivedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className="gap-1.5"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Platform access */}
            <Section title="Platform access">
              <Field
                icon={isAdmin ? <Shield className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                label="Permission level"
                value={
                  <Badge
                    className={
                      isAdmin
                        ? "bg-purple-100 text-purple-800"
                        : "bg-zinc-100 text-zinc-700"
                    }
                  >
                    {isAdmin ? "Admin" : "User"}
                  </Badge>
                }
              />
              <Field
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Department"
                value={departmentLabel(member.department)}
              />
            </Section>

            {/* Role & contact */}
            {(member.jobTitle || member.location || member.phone) && (
              <Section title="Role & contact">
                {member.jobTitle && (
                  <Field
                    icon={<Briefcase className="h-3.5 w-3.5" />}
                    label="Job title"
                    value={member.jobTitle}
                  />
                )}
                {member.location && (
                  <Field
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="Location"
                    value={member.location}
                  />
                )}
                <Field
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email"
                  value={
                    <a
                      href={`mailto:${member.email}`}
                      className="text-indigo-600 hover:underline font-mono text-xs"
                    >
                      {member.email}
                    </a>
                  }
                />
                {member.phone && (
                  <Field
                    icon={<Phone className="h-3.5 w-3.5" />}
                    label="Phone"
                    value={
                      <a
                        href={`tel:${member.phone}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {member.phone}
                      </a>
                    }
                  />
                )}
              </Section>
            )}

            {/* Bio */}
            {member.bio && (
              <Section title="Bio">
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {member.bio}
                </p>
              </Section>
            )}

            {/* Timeline */}
            <Section title="Timeline">
              {member.startedAt && (
                <Field
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Started"
                  value={format(new Date(member.startedAt), "MMMM d, yyyy")}
                />
              )}
              <Field
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Added to Motherboard"
                value={`${format(new Date(member.createdAt), "MMM d, yyyy")} (${formatDistanceToNow(new Date(member.createdAt))} ago)`}
              />
              {member.invitedAt && (
                <Field
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Invited"
                  value={`${formatDistanceToNow(new Date(member.invitedAt))} ago`}
                />
              )}
              <Field
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Last login"
                value={
                  member.lastLoginAt
                    ? `${formatDistanceToNow(new Date(member.lastLoginAt))} ago`
                    : <span className="italic text-zinc-400">Never signed in</span>
                }
              />
              {member.archivedAt && (
                <Field
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Archived"
                  value={`${formatDistanceToNow(new Date(member.archivedAt))} ago`}
                />
              )}
            </Section>

            <Section title="Internal">
              <Field
                icon={<Hash className="h-3.5 w-3.5" />}
                label="Member ID"
                value={
                  <span className="font-mono text-xs text-zinc-500">{member.id}</span>
                }
              />
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      <EditMemberDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-zinc-500 pt-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-zinc-900">{value}</div>
    </div>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  UserCheck,
  UserX,
  Calendar,
  Star,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import type { CampaignEvent } from "./campaign-detail-client";

interface Lead {
  leadId: string;
  personId: string;
  email: string;
  name: string | null;
  phone: string | null;
  ghlContactId: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referer: string | null;
  journeyStage: string;
  registeredAt: string;
  attendedAt: string | null;
  bookedCallAt: string | null;
}

const EVENT_ICON: Record<
  string,
  { icon: React.ElementType; tone: string; label: string }
> = {
  signup: { icon: UserCheck, tone: "text-blue-600", label: "Signed up" },
  attended: { icon: CheckCircle2, tone: "text-emerald-600", label: "Attended" },
  no_show: { icon: UserX, tone: "text-amber-600", label: "No show" },
  discovery_call_booked: {
    icon: Calendar,
    tone: "text-purple-600",
    label: "Booked discovery call",
  },
  customer: { icon: Star, tone: "text-pink-600", label: "Became customer" },
};

export function LeadJourneyDialog({
  lead,
  events,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  events: CampaignEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;

  const initials =
    lead.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || lead.email.slice(0, 2).toUpperCase();

  // Sort events oldest → newest for the timeline
  const timeline = [...events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Lead detail</DialogTitle>
        </DialogHeader>

        {/* Hero */}
        <div className="flex items-start gap-4 border-b pb-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{lead.name || "—"}</h2>
            <p className="font-mono text-sm text-zinc-600">{lead.email}</p>
            {lead.phone && (
              <p className="mt-0.5 font-mono text-xs text-zinc-500">
                {lead.phone}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <StageBadge stage={lead.journeyStage} />
              {lead.ghlContactId && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  GHL · {lead.ghlContactId.slice(0, 8)}…
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Attribution */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Source attribution
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <InfoRow label="Source" value={lead.source} />
            <InfoRow label="UTM source" value={lead.utmSource} mono />
            <InfoRow label="UTM medium" value={lead.utmMedium} mono />
            <InfoRow label="UTM campaign" value={lead.utmCampaign} mono />
            <InfoRow label="UTM content" value={lead.utmContent} mono />
            <InfoRow label="UTM term" value={lead.utmTerm} mono />
            {lead.referer && (
              <div className="col-span-2">
                <InfoRow label="Referer" value={lead.referer} mono truncate />
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Journey ({timeline.length} event{timeline.length === 1 ? "" : "s"})
          </h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-zinc-500">No events yet.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((event, idx) => {
                const def = EVENT_ICON[event.eventType] || {
                  icon: CircleDot,
                  tone: "text-zinc-500",
                  label: event.eventType.replace(/_/g, " "),
                };
                const Icon = def.icon;
                const isLast = idx === timeline.length - 1;
                return (
                  <li
                    key={event.id}
                    className="relative flex gap-3 pb-3"
                  >
                    {!isLast && (
                      <span
                        className="absolute left-[11px] top-7 bottom-0 w-px bg-zinc-200"
                        aria-hidden
                      />
                    )}
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200",
                        def.tone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 -mt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium capitalize">
                          {def.label}
                        </span>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {format(
                            new Date(event.occurredAt),
                            "MMM d, h:mm a",
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatDistanceToNow(new Date(event.occurredAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    registered: { label: "Registered", tone: "bg-blue-100 text-blue-700" },
    attended: { label: "Attended", tone: "bg-emerald-100 text-emerald-700" },
    no_show: { label: "No show", tone: "bg-amber-100 text-amber-700" },
    booked_call: {
      label: "Booked call",
      tone: "bg-purple-100 text-purple-700",
    },
    customer: { label: "Customer", tone: "bg-pink-100 text-pink-700" },
  };
  const def = map[stage] || { label: stage, tone: "bg-zinc-100 text-zinc-700" };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        def.tone,
      )}
    >
      {def.label}
    </span>
  );
}

function InfoRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "text-zinc-800",
          mono && "font-mono text-xs",
          truncate && "truncate",
        )}
      >
        {value || <span className="text-zinc-400">—</span>}
      </div>
    </div>
  );
}

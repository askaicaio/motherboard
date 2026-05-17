"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Copy,
  CheckCheck,
  Megaphone,
  RefreshCw,
  ExternalLink,
  Users,
  TrendingUp,
  Search,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LeadJourneyDialog } from "./lead-journey-dialog";

interface Campaign {
  id: string;
  name: string;
  type: string;
  description: string | null;
  eventDate: string | null;
  eventTimezone: string;
  status: string;
  webhookSecret: string;
  landingPageUrl: string | null;
  ghlWorkflowId: string | null;
  createdAt: string;
}

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

export interface CampaignEvent {
  id: string;
  leadId: string | null;
  personId: string | null;
  eventType: string;
  eventData: Record<string, unknown> | null;
  occurredAt: string;
}

interface SourceBucket {
  source: string;
  count: number;
}

const STAGE_LABEL: Record<string, { label: string; tone: string }> = {
  registered: { label: "Registered", tone: "bg-blue-100 text-blue-700" },
  attended: { label: "Attended", tone: "bg-emerald-100 text-emerald-700" },
  no_show: { label: "No show", tone: "bg-amber-100 text-amber-700" },
  booked_call: { label: "Booked call", tone: "bg-purple-100 text-purple-700" },
  customer: { label: "Customer", tone: "bg-pink-100 text-pink-700" },
};

export function CampaignDetailClient({
  baseUrl,
  campaign,
  leads,
  events,
  sourceBreakdown,
}: {
  baseUrl: string;
  campaign: Campaign;
  leads: Lead[];
  events: CampaignEvent[];
  sourceBreakdown: SourceBucket[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const webhookBase = `${baseUrl}/api/campaigns/${campaign.id}/webhook/${campaign.webhookSecret}`;

  // Derived metrics
  const stats = useMemo(() => {
    const total = leads.length;
    const attended = leads.filter((l) =>
      ["attended", "booked_call", "customer"].includes(l.journeyStage),
    ).length;
    const noShow = leads.filter((l) => l.journeyStage === "no_show").length;
    const bookedCall = leads.filter((l) =>
      ["booked_call", "customer"].includes(l.journeyStage),
    ).length;
    const conversion = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, noShow, bookedCall, conversion };
  }, [leads]);

  // Filtered table view
  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== "all" && l.journeyStage !== stageFilter) return false;
      if (!q) return true;
      return (
        l.email.toLowerCase().includes(q) ||
        (l.name?.toLowerCase().includes(q) ?? false) ||
        (l.utmSource?.toLowerCase().includes(q) ?? false) ||
        (l.utmCampaign?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [leads, query, stageFilter]);

  // Events for the currently-selected lead
  const selectedLeadEvents = useMemo(() => {
    if (!selectedLead) return [];
    return events.filter((e) => e.leadId === selectedLead.leadId);
  }, [events, selectedLead]);

  const eventDate = campaign.eventDate ? new Date(campaign.eventDate) : null;
  const isUpcoming = eventDate ? eventDate > new Date() : false;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All campaigns
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-zinc-500" />
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {campaign.name}
              </h1>
              <Badge variant="secondary" className="capitalize">
                {campaign.type.replace(/_/g, " ")}
              </Badge>
              {campaign.status !== "active" && (
                <Badge variant="outline" className="capitalize">
                  {campaign.status}
                </Badge>
              )}
            </div>
            {eventDate && (
              <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="h-4 w-4" />
                {format(eventDate, "EEEE, MMM d, yyyy 'at' h:mm a")} ({campaign.eventTimezone})
                {isUpcoming && (
                  <span className="text-zinc-400">
                    · in {formatDistanceToNow(eventDate)}
                  </span>
                )}
              </p>
            )}
            {campaign.description && (
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                {campaign.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Signups"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label={isUpcoming ? "(Pending)" : "Attended"}
          value={isUpcoming ? "—" : stats.attended}
          icon={<CheckCheck className="h-4 w-4" />}
        />
        <MetricCard
          label="Booked calls"
          value={stats.bookedCall}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Conversion"
          value={isUpcoming ? "—" : `${stats.conversion}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Default to Setup tab when there are zero leads — the user is in
          configuration mode and the most useful thing to show is the
          webhook URLs they need to paste into GHL. Once leads exist,
          default to the Leads tab where they'll spend most of their time. */}
      <Tabs defaultValue={leads.length === 0 ? "setup" : "leads"}>
        <TabsList>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        {/* ============== LEADS ============== */}
        <TabsContent value="leads" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search by name, email, source..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">All stages</option>
              <option value="registered">Registered</option>
              <option value="attended">Attended</option>
              <option value="no_show">No show</option>
              <option value="booked_call">Booked call</option>
              <option value="customer">Customer</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredLeads.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-zinc-500">
                  {leads.length === 0
                    ? "No signups yet — once the webhook fires, leads will appear here."
                    : "No leads match your filters."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name / Email</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const stage = STAGE_LABEL[lead.journeyStage] || {
                        label: lead.journeyStage,
                        tone: "bg-zinc-100 text-zinc-700",
                      };
                      const displaySource =
                        lead.utmSource ||
                        lead.source ||
                        (lead.referer ? "Referral" : "Direct");
                      return (
                        <TableRow
                          key={lead.leadId}
                          className="cursor-pointer"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <TableCell>
                            <div className="font-medium">
                              {lead.name || "—"}
                            </div>
                            <div className="text-xs text-zinc-500 font-mono">
                              {lead.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                stage.tone,
                              )}
                            >
                              {stage.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{displaySource}</div>
                            {lead.utmCampaign && (
                              <div className="text-xs text-zinc-500">
                                {lead.utmMedium && `${lead.utmMedium} · `}
                                {lead.utmCampaign}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600">
                            {format(new Date(lead.registeredAt), "MMM d, h:mm a")}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== SOURCES ============== */}
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Where leads came from
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceBreakdown.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No signups yet. Sources will appear once leads come in via
                  the webhook.
                </p>
              ) : (
                <div className="space-y-2">
                  {sourceBreakdown.map((s) => {
                    const max = sourceBreakdown[0]?.count || 1;
                    const pct = Math.round((s.count / max) * 100);
                    const sharePct =
                      stats.total > 0
                        ? Math.round((s.count / stats.total) * 100)
                        : 0;
                    return (
                      <div key={s.source} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.source}</span>
                          <span className="text-zinc-500">
                            {s.count} · {sharePct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full bg-zinc-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== ACTIVITY LOG ============== */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-zinc-500">
                  No activity yet.
                </div>
              ) : (
                <div className="divide-y">
                  {events.slice(0, 100).map((e) => {
                    const data = e.eventData as
                      | { email?: string; name?: string; utmSource?: string }
                      | null;
                    return (
                      <div
                        key={e.id}
                        className="flex items-start gap-3 px-4 py-3 text-sm"
                      >
                        <Badge
                          variant="outline"
                          className="mt-0.5 capitalize font-mono text-[10px]"
                        >
                          {e.eventType.replace(/_/g, " ")}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {data?.name && (
                              <span className="font-medium">{data.name} · </span>
                            )}
                            {data?.email && (
                              <span className="font-mono text-xs text-zinc-600">
                                {data.email}
                              </span>
                            )}
                            {!data?.email && !data?.name && (
                              <span className="text-zinc-500">
                                (no payload data)
                              </span>
                            )}
                            {data?.utmSource && (
                              <span className="ml-2 text-xs text-zinc-500">
                                via {data.utmSource}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500 whitespace-nowrap">
                          {format(new Date(e.occurredAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== SETUP ============== */}
        <TabsContent value="setup" className="space-y-4">
          <WebhookSetupCard
            campaignName={campaign.name}
            webhookBase={webhookBase}
            campaignId={campaign.id}
          />
        </TabsContent>
      </Tabs>

      <LeadJourneyDialog
        lead={selectedLead}
        events={selectedLeadEvents}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function WebhookSetupCard({
  campaignName,
  webhookBase,
  campaignId,
}: {
  campaignName: string;
  webhookBase: string;
  campaignId: string;
}) {
  const router = useRouter();
  const [rotating, setRotating] = useState(false);

  const eventUrls = {
    signup: `${webhookBase}?event=signup`,
    attended: `${webhookBase}?event=attended`,
    no_show: `${webhookBase}?event=no_show`,
    booked: `${webhookBase}?event=discovery_call_booked`,
  };

  async function rotateSecret() {
    if (
      !confirm(
        "Rotate the webhook secret? The current URL will stop working immediately — you'll need to update GHL with the new URL.",
      )
    )
      return;
    setRotating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/rotate-secret`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to rotate secret");
        return;
      }
      toast.success("New webhook secret generated");
      router.refresh();
    } finally {
      setRotating(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Webhook URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-600">
            Each URL captures a different stage in the lead journey. Paste them
            into the corresponding GHL Workflow&apos;s <em>Webhook</em> action.
          </p>
          <CopyRow label="Signup" url={eventUrls.signup} />
          <CopyRow label="Attended" url={eventUrls.attended} />
          <CopyRow label="No show" url={eventUrls.no_show} />
          <CopyRow label="Discovery call booked" url={eventUrls.booked} />

          <div className="flex justify-end border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={rotateSecret}
              disabled={rotating}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-4 w-4",
                  rotating && "animate-spin",
                )}
              />
              Rotate secret
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            How to wire this up in GHL — {campaignName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-700">
          <Step n={1} title="Open the signup workflow">
            In GHL, go to <strong>Automation → Workflows</strong> and open the
            workflow that fires when someone submits the signup form (the one
            connected to your existing <em>webhook trigger</em>).
          </Step>
          <Step n={2} title="Add a Webhook action">
            After the existing actions (add contact, send confirmation), click
            the <strong>+</strong> and add a <strong>Webhook</strong> action.
            Method: <code className="rounded bg-zinc-100 px-1">POST</code>.
            URL: the <strong>Signup</strong> URL above.
          </Step>
          <Step n={3} title="Set the body to a JSON contact payload">
            Use GHL&apos;s custom field merge tags. Map at minimum:{" "}
            <code className="rounded bg-zinc-100 px-1">email</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">first_name</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">last_name</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">phone</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">source</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">utm_source</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">utm_medium</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">utm_campaign</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">contact_id</code>.
          </Step>
          <Step n={4} title="(Optional) Add attendance + booking workflows">
            Build separate GHL workflows triggered by Zoom attendance and
            calendar bookings — point each at the matching webhook URL above
            (Attended / No show / Discovery call booked).
          </Step>
          <a
            href="https://help.gohighlevel.com/support/solutions/articles/48001215792"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
          >
            GHL docs: outbound webhooks
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
        {n}
      </div>
      <div className="flex-1 space-y-1">
        <div className="font-medium">{title}</div>
        <div className="text-zinc-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(`${label} URL copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-md border bg-zinc-50 px-3 py-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs font-mono text-zinc-700">
          {url}
        </code>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? (
            <CheckCheck className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

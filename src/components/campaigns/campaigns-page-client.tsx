"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Calendar, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { CreateCampaignDialog } from "./create-campaign-dialog";

export interface CampaignListItem {
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
  leadCount: number;
  attendedCount: number;
  createdAt: string;
}

export function CampaignsPageClient({
  initialCampaigns,
  baseUrl,
}: {
  initialCampaigns: CampaignListItem[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [createOpen, setCreateOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const upcoming: CampaignListItem[] = [];
    const past: CampaignListItem[] = [];
    for (const c of campaigns) {
      if (c.eventDate && isPast(new Date(c.eventDate))) past.push(c);
      else upcoming.push(c);
    }
    return { upcoming, past };
  }, [campaigns]);

  const handleCreated = (created: CampaignListItem) => {
    setCampaigns((prev) => [created, ...prev]);
    toast.success(`Created "${created.name}"`);
    router.push(`/campaigns/${created.id}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Monitor signups and lead journeys for marketing campaigns. Each
            campaign exposes a webhook URL you wire into GHL.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Upcoming & active" items={upcoming} />
          )}
          {past.length > 0 && <Section title="Past" items={past} />}
        </>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        baseUrl={baseUrl}
      />
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: CampaignListItem[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </section>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const eventDate = campaign.eventDate ? new Date(campaign.eventDate) : null;
  const conversionPct =
    campaign.leadCount > 0
      ? Math.round((campaign.attendedCount / campaign.leadCount) * 100)
      : 0;

  return (
    <Link href={`/campaigns/${campaign.id}`} className="group block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium group-hover:underline">
                {campaign.name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize text-xs">
                  {campaign.type.replace(/_/g, " ")}
                </Badge>
                {campaign.status !== "active" && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {campaign.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {eventDate && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {format(eventDate, "MMM d, yyyy 'at' h:mm a")}
                {isFuture(eventDate) && (
                  <span className="ml-1 text-zinc-400">
                    · in {formatDistanceToNow(eventDate)}
                  </span>
                )}
              </span>
            </div>
          )}

          {campaign.description && (
            <p className="line-clamp-2 text-sm text-zinc-600">
              {campaign.description}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <Stat label="Signups" value={campaign.leadCount} />
            <Stat label="Attended" value={campaign.attendedCount} />
            <Stat label="Conv." value={`${conversionPct}%`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-zinc-100 p-3">
          <Megaphone className="h-6 w-6 text-zinc-500" />
        </div>
        <div>
          <h3 className="font-medium">No campaigns yet</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Create your first campaign to start monitoring signups via webhook.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create your first campaign
        </Button>
        <a
          href="https://help.gohighlevel.com/support/solutions/articles/48001215792"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
        >
          How GHL outbound webhooks work
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}

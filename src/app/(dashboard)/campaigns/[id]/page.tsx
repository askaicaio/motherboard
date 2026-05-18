// Campaign detail page — fetches the campaign + leads + events + source
// breakdown in one server pass, then hands off to a client component.

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignLeads,
  campaignPeople,
  campaignEvents,
} from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { CampaignDetailClient } from "@/components/campaigns/campaign-detail-client";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  // 1. Campaign itself
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  if (!campaign) notFound();

  // 2. Leads with person info joined
  const leadRows = await db
    .select({
      leadId: campaignLeads.id,
      personId: campaignPeople.id,
      email: campaignPeople.email,
      name: campaignPeople.name,
      phone: campaignPeople.phone,
      ghlContactId: campaignPeople.ghlContactId,
      source: campaignLeads.source,
      utmSource: campaignLeads.utmSource,
      utmMedium: campaignLeads.utmMedium,
      utmCampaign: campaignLeads.utmCampaign,
      utmContent: campaignLeads.utmContent,
      utmTerm: campaignLeads.utmTerm,
      referer: campaignLeads.referer,
      journeyStage: campaignLeads.journeyStage,
      registeredAt: campaignLeads.registeredAt,
      attendedAt: campaignLeads.attendedAt,
      bookedCallAt: campaignLeads.bookedCallAt,
    })
    .from(campaignLeads)
    .leftJoin(campaignPeople, eq(campaignLeads.personId, campaignPeople.id))
    .where(eq(campaignLeads.campaignId, id))
    .orderBy(desc(campaignLeads.registeredAt));

  // 3. Recent events (last 100) for the activity log + per-lead timelines
  const eventRows = await db
    .select({
      id: campaignEvents.id,
      leadId: campaignEvents.leadId,
      personId: campaignEvents.personId,
      eventType: campaignEvents.eventType,
      eventData: campaignEvents.eventData,
      occurredAt: campaignEvents.occurredAt,
    })
    .from(campaignEvents)
    .where(eq(campaignEvents.campaignId, id))
    .orderBy(desc(campaignEvents.occurredAt))
    .limit(500);

  // 4. Anonymous visit count — quiz_visit / page_view events that fired
  // before the lead converted. Lets us show a real funnel: visits → signups.
  const [visitCountRow] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(campaignEvents)
    .where(
      sql`${campaignEvents.campaignId} = ${id}
          AND ${campaignEvents.eventType} IN ('quiz_visit','page_view')`,
    );
  const visitCount = visitCountRow?.count ?? 0;

  // 5. Source breakdown (utm_source if present, else "source", else "Direct")
  const sourceRows = await db
    .select({
      source: sql<string>`COALESCE(
        NULLIF(${campaignLeads.utmSource}, ''),
        NULLIF(${campaignLeads.source}, ''),
        'Direct'
      )`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(campaignLeads)
    .where(eq(campaignLeads.campaignId, id))
    .groupBy(
      sql`COALESCE(NULLIF(${campaignLeads.utmSource}, ''), NULLIF(${campaignLeads.source}, ''), 'Direct')`,
    )
    .orderBy(sql`COUNT(*) DESC`);

  // Base URL for webhook copy-paste — derives from the actual host header
  const hdrs = await headers();
  const host = hdrs.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <CampaignDetailClient
      baseUrl={baseUrl}
      campaign={{
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        description: campaign.description,
        eventDate: campaign.eventDate ? campaign.eventDate.toISOString() : null,
        eventTimezone: campaign.eventTimezone || "America/New_York",
        status: campaign.status,
        webhookSecret: campaign.webhookSecret,
        landingPageUrl: campaign.landingPageUrl,
        ghlWorkflowId: campaign.ghlWorkflowId,
        ghlTag: campaign.ghlTag,
        ghlLastSyncedAt: campaign.ghlLastSyncedAt
          ? campaign.ghlLastSyncedAt.toISOString()
          : null,
        ghlLastSyncStatus: campaign.ghlLastSyncStatus,
        ghlLastSyncCount: campaign.ghlLastSyncCount,
        ghlLastSyncError: campaign.ghlLastSyncError,
        createdAt: campaign.createdAt.toISOString(),
      }}
      leads={leadRows.map((l) => ({
        leadId: l.leadId,
        personId: l.personId!,
        email: l.email!,
        name: l.name,
        phone: l.phone,
        ghlContactId: l.ghlContactId,
        source: l.source,
        utmSource: l.utmSource,
        utmMedium: l.utmMedium,
        utmCampaign: l.utmCampaign,
        utmContent: l.utmContent,
        utmTerm: l.utmTerm,
        referer: l.referer,
        journeyStage: l.journeyStage,
        registeredAt: l.registeredAt.toISOString(),
        attendedAt: l.attendedAt ? l.attendedAt.toISOString() : null,
        bookedCallAt: l.bookedCallAt ? l.bookedCallAt.toISOString() : null,
      }))}
      events={eventRows.map((e) => ({
        id: e.id,
        leadId: e.leadId,
        personId: e.personId,
        eventType: e.eventType,
        eventData: e.eventData as Record<string, unknown> | null,
        occurredAt: e.occurredAt.toISOString(),
      }))}
      sourceBreakdown={sourceRows.map((r) => ({
        source: r.source,
        count: r.count,
      }))}
      visitCount={visitCount}
    />
  );
}

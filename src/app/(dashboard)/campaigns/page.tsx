// Campaigns list page — server component fetches initial data then hands
// off to a client component for the interactive table + dialogs.

import { db } from "@/lib/db";
import { campaigns, campaignLeads } from "@/lib/db/schema";
import { desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { CampaignsPageClient } from "@/components/campaigns/campaigns-page-client";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      description: campaigns.description,
      eventDate: campaigns.eventDate,
      eventTimezone: campaigns.eventTimezone,
      status: campaigns.status,
      webhookSecret: campaigns.webhookSecret,
      landingPageUrl: campaigns.landingPageUrl,
      ghlWorkflowId: campaigns.ghlWorkflowId,
      createdAt: campaigns.createdAt,
      leadCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${campaignLeads}
        WHERE ${campaignLeads.campaignId} = ${campaigns.id}
      )`,
      attendedCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${campaignLeads}
        WHERE ${campaignLeads.campaignId} = ${campaigns.id}
          AND ${campaignLeads.journeyStage} IN ('attended','booked_call','customer')
      )`,
    })
    .from(campaigns)
    .where(isNull(campaigns.archivedAt))
    .orderBy(desc(campaigns.createdAt));

  // Build the absolute base URL for webhook copy-paste. host header is
  // the actual incoming Host, so this works in preview + production.
  const hdrs = await headers();
  const host = hdrs.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <CampaignsPageClient
      initialCampaigns={rows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        description: c.description,
        eventDate: c.eventDate ? c.eventDate.toISOString() : null,
        eventTimezone: c.eventTimezone || "America/New_York",
        status: c.status,
        webhookSecret: c.webhookSecret,
        landingPageUrl: c.landingPageUrl,
        ghlWorkflowId: c.ghlWorkflowId,
        leadCount: c.leadCount,
        attendedCount: c.attendedCount,
        createdAt: c.createdAt.toISOString(),
      }))}
      baseUrl={baseUrl}
    />
  );
}

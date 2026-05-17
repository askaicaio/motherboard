// GET    /api/campaigns          — list (newest first, optionally including archived)
// POST   /api/campaigns          — create a new campaign + generate webhook secret

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { campaigns, campaignLeads } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { desc, isNull, isNotNull, sql } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().default("webinar"),
  description: z.string().optional().nullable(),
  eventDate: z.string().optional().nullable(), // ISO 8601
  eventTimezone: z.string().optional().default("America/New_York"),
  landingPageUrl: z.string().url().optional().nullable(),
  ghlWorkflowId: z.string().optional().nullable(),
});

function generateSecret(): string {
  // 32 url-safe bytes (~43 chars) — long enough that a leak isn't catastrophic
  return randomBytes(32).toString("base64url");
}

/** GET /api/campaigns?archived=1 */
export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const archived = request.nextUrl.searchParams.get("archived") === "1";

  // Pull campaigns with their lead counts in one query
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
      archivedAt: campaigns.archivedAt,
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
    .where(archived ? isNotNull(campaigns.archivedAt) : isNull(campaigns.archivedAt))
    .orderBy(desc(campaigns.createdAt));

  return NextResponse.json({ campaigns: rows });
}

/** POST /api/campaigns */
export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = createSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [created] = await db
    .insert(campaigns)
    .values({
      name: body.name,
      type: body.type,
      description: body.description ?? null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      eventTimezone: body.eventTimezone ?? "America/New_York",
      landingPageUrl: body.landingPageUrl ?? null,
      ghlWorkflowId: body.ghlWorkflowId ?? null,
      webhookSecret: generateSecret(),
      status: "active",
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ campaign: created }, { status: 201 });
}

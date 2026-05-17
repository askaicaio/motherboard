// GET    /api/campaigns/[id]   — single campaign detail
// PATCH  /api/campaigns/[id]   — update fields
// DELETE /api/campaigns/[id]   — soft-archive

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().optional(),
  description: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  eventTimezone: z.string().optional(),
  status: z.enum(["active", "draft", "completed", "archived"]).optional(),
  landingPageUrl: z.string().url().nullable().optional(),
  ghlWorkflowId: z.string().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.type !== undefined) patch.type = body.type;
  if (body.description !== undefined) patch.description = body.description;
  if (body.eventDate !== undefined)
    patch.eventDate = body.eventDate ? new Date(body.eventDate) : null;
  if (body.eventTimezone !== undefined) patch.eventTimezone = body.eventTimezone;
  if (body.status !== undefined) patch.status = body.status;
  if (body.landingPageUrl !== undefined) patch.landingPageUrl = body.landingPageUrl;
  if (body.ghlWorkflowId !== undefined) patch.ghlWorkflowId = body.ghlWorkflowId;

  const [updated] = await db
    .update(campaigns)
    .set(patch)
    .where(eq(campaigns.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [archived] = await db
    .update(campaigns)
    .set({
      archivedAt: new Date(),
      archivedBy: user.id,
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, id))
    .returning();

  if (!archived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign: archived });
}

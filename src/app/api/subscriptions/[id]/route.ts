// PATCH  /api/subscriptions/[id] — partial update
// DELETE /api/subscriptions/[id] — soft archive

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  serviceName: z.string().max(200).nullable().optional(),
  ownerEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  isStarred: z.boolean().optional(),
  websiteUrl: z.string().url().max(500).nullable().optional().or(z.literal("")),
  departments: z.array(z.string().max(80)).max(20).optional(),
  inOnePassword: z.boolean().optional(),
  monthlyCostUsd: z.number().nullable().optional(),
  annualCostUsd: z.number().nullable().optional(),
  renewalDate: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  tag: z.string().max(200).nullable().optional(),
  status: z.string().max(100).optional(),
});

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
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.serviceName !== undefined)
    patch.serviceName = body.serviceName?.trim() || null;
  if (body.ownerEmail !== undefined)
    patch.ownerEmail = body.ownerEmail
      ? body.ownerEmail.toLowerCase().trim()
      : null;
  if (body.isStarred !== undefined) patch.isStarred = body.isStarred;
  if (body.websiteUrl !== undefined)
    patch.websiteUrl = body.websiteUrl?.trim() || null;
  if (body.departments !== undefined)
    patch.departments = body.departments.map((d) => d.trim()).filter(Boolean);
  if (body.inOnePassword !== undefined) patch.inOnePassword = body.inOnePassword;
  if (body.monthlyCostUsd !== undefined)
    patch.monthlyCostUsd =
      body.monthlyCostUsd != null ? String(body.monthlyCostUsd) : null;
  if (body.annualCostUsd !== undefined)
    patch.annualCostUsd =
      body.annualCostUsd != null ? String(body.annualCostUsd) : null;
  if (body.renewalDate !== undefined)
    patch.renewalDate = body.renewalDate || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.tag !== undefined) patch.tag = body.tag?.trim() || null;
  if (body.status !== undefined) patch.status = body.status;

  const [updated] = await db
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ subscription: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [archived] = await db
    .update(subscriptions)
    .set({
      archivedAt: new Date(),
      archivedBy: user.id,
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))
    .returning();

  if (!archived) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ subscription: archived });
}

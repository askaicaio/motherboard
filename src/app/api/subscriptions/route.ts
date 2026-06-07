// GET  /api/subscriptions — list (optionally including archived)
// POST /api/subscriptions — create a new row

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { desc, isNull, isNotNull } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1).max(300),
  serviceName: z.string().max(200).nullable().optional(),
  ownerEmail: z.string().email().max(200).nullable().optional(),
  isStarred: z.boolean().optional().default(false),
  websiteUrl: z.string().url().max(500).nullable().optional(),
  departments: z.array(z.string().max(80)).max(20).optional().default([]),
  inOnePassword: z.boolean().optional().default(false),
  monthlyCostUsd: z.number().nullable().optional(),
  annualCostUsd: z.number().nullable().optional(),
  renewalDate: z.string().nullable().optional(), // ISO yyyy-mm-dd
  notes: z.string().max(5000).nullable().optional(),
  tag: z.string().max(200).nullable().optional(),
  // Status is free-form (max 100) to faithfully preserve the ClickUp
  // status spectrum (e.g. "subscription", "free account", "not working",
  // "archived working", "cancelled subscription", etc.) instead of
  // forcing them into a narrow enum.
  status: z.string().max(100).optional().default("active"),
});

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "1";

  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      includeArchived
        ? isNotNull(subscriptions.id) // no-op filter — return everything
        : isNull(subscriptions.archivedAt),
    )
    .orderBy(desc(subscriptions.isStarred), subscriptions.name);

  return NextResponse.json({ subscriptions: rows });
}

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

  // Auto-derive annual if monthly given but annual missing
  let annual = body.annualCostUsd ?? null;
  if (annual === null && body.monthlyCostUsd != null) {
    annual = Math.round(body.monthlyCostUsd * 1200) / 100;
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      name: body.name.trim(),
      serviceName: body.serviceName?.trim() || null,
      ownerEmail: body.ownerEmail?.toLowerCase().trim() || null,
      isStarred: body.isStarred,
      websiteUrl: body.websiteUrl?.trim() || null,
      departments: body.departments.map((d) => d.trim()).filter(Boolean),
      inOnePassword: body.inOnePassword,
      // Drizzle's numeric type expects a string for insert
      monthlyCostUsd: body.monthlyCostUsd != null ? String(body.monthlyCostUsd) : null,
      annualCostUsd: annual != null ? String(annual) : null,
      renewalDate: body.renewalDate || null,
      notes: body.notes?.trim() || null,
      tag: body.tag?.trim() || null,
      status: body.status,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ subscription: created }, { status: 201 });
}

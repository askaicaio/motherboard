// GET  /api/partners/attribution — list attribution events (admin)
// POST /api/partners/attribution — record a direct introduction (admin)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerAttributionEvents, partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { desc, eq } from "drizzle-orm";
import { isDirectIntroValid } from "@/lib/partners/rules";

const createSchema = z.object({
  partnerId: z.string().uuid(),
  prospectEmail: z.string().email().max(200),
  prospectName: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  sourceDetail: z.string().max(500).nullable().optional(),
  recordedAt: z.string().min(1), // ISO datetime
  proposalSentAt: z.string().nullable().optional(), // ISO datetime
  notes: z.string().max(5000).nullable().optional(),
});

export async function GET() {
  await requireRole("admin");

  const rows = await db
    .select({
      id: partnerAttributionEvents.id,
      partnerId: partnerAttributionEvents.partnerId,
      partnerName: partners.name,
      type: partnerAttributionEvents.type,
      prospectEmail: partnerAttributionEvents.prospectEmail,
      prospectName: partnerAttributionEvents.prospectName,
      company: partnerAttributionEvents.company,
      sourceDetail: partnerAttributionEvents.sourceDetail,
      recordedAt: partnerAttributionEvents.recordedAt,
      proposalSentAt: partnerAttributionEvents.proposalSentAt,
      isValid: partnerAttributionEvents.isValid,
      notes: partnerAttributionEvents.notes,
    })
    .from(partnerAttributionEvents)
    .leftJoin(partners, eq(partnerAttributionEvents.partnerId, partners.id))
    .orderBy(desc(partnerAttributionEvents.recordedAt))
    .limit(500);

  return NextResponse.json({ events: rows });
}

export async function POST(request: NextRequest) {
  const user = await requireRole("admin");

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

  const recordedAt = new Date(body.recordedAt);
  const proposalSentAt = body.proposalSentAt ? new Date(body.proposalSentAt) : null;
  const isValid = isDirectIntroValid(recordedAt, proposalSentAt);

  const [created] = await db
    .insert(partnerAttributionEvents)
    .values({
      partnerId: body.partnerId,
      type: "direct_intro",
      prospectEmail: body.prospectEmail.toLowerCase().trim(),
      prospectName: body.prospectName?.trim() || null,
      company: body.company?.trim() || null,
      sourceDetail: body.sourceDetail?.trim() || null,
      recordedAt,
      proposalSentAt,
      isValid,
      notes: body.notes?.trim() || null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ event: created }, { status: 201 });
}

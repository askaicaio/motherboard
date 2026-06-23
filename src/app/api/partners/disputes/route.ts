// GET  /api/partners/disputes — admin list of all disputes.
// POST /api/partners/disputes — PUBLIC partner submission. Resolves the
//   partner by ref code, enforces the 14-day dispute window (Terms §5.4),
//   and files the dispute as status='open'.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerDisputes, partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { disputeWithinWindow } from "@/lib/partners/rules";
import { desc, eq } from "drizzle-orm";

const submitSchema = z.object({
  partnerRefCode: z.string().min(1).max(64),
  conversionId: z.string().uuid().nullable().optional(),
  dealCloseDate: z.string().min(1), // ISO date/datetime
  evidence: z.string().min(1).max(10000),
});

export async function GET() {
  await requireRole("admin");

  const rows = await db
    .select({
      id: partnerDisputes.id,
      partnerId: partnerDisputes.partnerId,
      partnerName: partners.name,
      partnerEmail: partners.email,
      conversionId: partnerDisputes.conversionId,
      submittedAt: partnerDisputes.submittedAt,
      dealCloseDate: partnerDisputes.dealCloseDate,
      evidence: partnerDisputes.evidence,
      status: partnerDisputes.status,
      resolution: partnerDisputes.resolution,
      decidedAt: partnerDisputes.decidedAt,
    })
    .from(partnerDisputes)
    .leftJoin(partners, eq(partnerDisputes.partnerId, partners.id))
    .orderBy(desc(partnerDisputes.submittedAt));

  return NextResponse.json({ disputes: rows });
}

// PUBLIC — no auth. Partners submit disputes via their ref code.
export async function POST(request: NextRequest) {
  let body;
  try {
    body = submitSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const dealCloseDate = new Date(body.dealCloseDate);
  if (Number.isNaN(dealCloseDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid dealCloseDate" },
      { status: 400 },
    );
  }

  // Resolve the partner from the ref code.
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.refCode, body.partnerRefCode))
    .limit(1);

  if (!partner) {
    return NextResponse.json({ error: "Unknown partner" }, { status: 404 });
  }

  // Enforce the 14-day-from-close dispute window (Terms §5.4).
  const now = new Date();
  if (!disputeWithinWindow(dealCloseDate, now)) {
    return NextResponse.json(
      { error: "Dispute window has closed (14 days from deal close)" },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(partnerDisputes)
    .values({
      partnerId: partner.id,
      conversionId: body.conversionId ?? null,
      dealCloseDate,
      evidence: body.evidence.trim(),
      status: "open",
    })
    .returning();

  return NextResponse.json({ dispute: created }, { status: 201 });
}

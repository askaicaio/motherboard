// GET  /api/partners/settings — latest effective settings version
// POST /api/partners/settings — append a NEW settings version (admin only)
//
// partner_settings is append-only history: each save inserts a new row
// with effective_from = now. The "current" config is the row with the
// most recent effective_from. We never UPDATE prior rows.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerSettings } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { desc } from "drizzle-orm";

const createSchema = z.object({
  cookieWindowDays: z.number().int().min(0).max(365),
  // Decimal string e.g. "0.10" for 10%. Validate it parses to a 0–1 rate.
  defaultCommissionRate: z
    .string()
    .regex(/^\d*\.?\d+$/, "Must be a decimal like 0.10")
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 1;
    }, "Rate must be between 0 and 1"),
  refundWindowDays: z.number().int().min(0).max(365),
  payoutTermsDays: z.number().int().min(0).max(365),
  minPayoutCents: z.number().int().min(0),
});

export async function GET() {
  const [latest] = await db
    .select()
    .from(partnerSettings)
    .orderBy(desc(partnerSettings.effectiveFrom))
    .limit(1);

  return NextResponse.json({ settings: latest ?? null });
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

  const [created] = await db
    .insert(partnerSettings)
    .values({
      cookieWindowDays: body.cookieWindowDays,
      defaultCommissionRate: body.defaultCommissionRate,
      refundWindowDays: body.refundWindowDays,
      payoutTermsDays: body.payoutTermsDays,
      minPayoutCents: body.minPayoutCents,
      effectiveFrom: new Date(),
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ settings: created }, { status: 201 });
}

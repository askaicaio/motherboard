// POST /api/partners/[id]/decline — decline a partner application (admin).
// Sets status='declined', stamps declinedAt, records the reason.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const declineSchema = z.object({
  reason: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;

  let body: z.infer<typeof declineSchema> = {};
  try {
    // Body is optional — tolerate an empty request.
    const json = await request.json().catch(() => ({}));
    body = declineSchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const now = new Date();
  const [updated] = await db
    .update(partners)
    .set({
      status: "declined",
      declinedAt: now,
      declineReason: body.reason?.trim() || null,
      updatedAt: now,
    })
    .where(eq(partners.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ partner: updated });
}

// POST /api/partners/disputes/[id]/decide — admin records a dispute decision.
// Sets status + resolution + decidedAt=now + decidedBy=user.id.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerDisputes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const decideSchema = z.object({
  status: z.enum(["upheld", "denied", "closed"]),
  resolution: z.string().max(10000).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;

  let body;
  try {
    body = decideSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [updated] = await db
    .update(partnerDisputes)
    .set({
      status: body.status,
      resolution: body.resolution?.trim() || null,
      decidedAt: new Date(),
      decidedBy: user.id,
    })
    .where(eq(partnerDisputes.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  return NextResponse.json({ dispute: updated });
}

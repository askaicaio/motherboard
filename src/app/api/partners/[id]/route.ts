// GET   /api/partners/[id] — fetch one partner (admin)
// PATCH /api/partners/[id] — edit profile / status fields (admin)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  company: z.string().max(300).nullable().optional().or(z.literal("")),
  status: z
    .enum([
      "applied",
      "approved",
      "declined",
      "active",
      "suspended",
      "terminated",
    ])
    .optional(),
  taxFormStatus: z
    .enum(["none", "w9", "w8ben", "w8bene", "invalid"])
    .optional(),
  payoutMethod: z.enum(["ach", "zelle", "none"]).optional(),
  payoutDetails: z.string().max(5000).nullable().optional().or(z.literal("")),
  notes: z.string().max(5000).nullable().optional().or(z.literal("")),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;
  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, id));

  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ partner });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

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
  if (body.company !== undefined) patch.company = body.company?.trim() || null;
  if (body.status !== undefined) patch.status = body.status;
  if (body.taxFormStatus !== undefined) patch.taxFormStatus = body.taxFormStatus;
  if (body.payoutMethod !== undefined) patch.payoutMethod = body.payoutMethod;
  if (body.payoutDetails !== undefined)
    patch.payoutDetails = body.payoutDetails?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  const [updated] = await db
    .update(partners)
    .set(patch)
    .where(eq(partners.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ partner: updated });
}

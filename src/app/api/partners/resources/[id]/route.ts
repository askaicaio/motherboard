// PATCH  /api/partners/resources/[id] — edit metadata (admin)
// DELETE /api/partners/resources/[id] — archive (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerResources } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(50).optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

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
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.category !== undefined) patch.category = body.category;
  if (body.isPublic !== undefined) patch.isPublic = body.isPublic;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;

  const [updated] = await db
    .update(partnerResources)
    .set(patch)
    .where(eq(partnerResources.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ resource: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;
  const [archived] = await db
    .update(partnerResources)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(partnerResources.id, id))
    .returning();
  if (!archived) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

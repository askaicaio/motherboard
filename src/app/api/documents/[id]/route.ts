// PATCH  /api/documents/[id]  — edit
// DELETE /api/documents/[id]  — soft-archive

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  url: z.string().url().max(2000).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  pinned: z.boolean().optional(),
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
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.url !== undefined) patch.url = body.url.trim();
  if (body.description !== undefined)
    patch.description = body.description?.trim() || null;
  if (body.category !== undefined)
    patch.category = body.category?.trim() || null;
  if (body.tags !== undefined)
    patch.tags = body.tags.map((t) => t.trim()).filter(Boolean);
  if (body.pinned !== undefined) patch.pinned = body.pinned;

  const [updated] = await db
    .update(documents)
    .set(patch)
    .where(eq(documents.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ document: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [archived] = await db
    .update(documents)
    .set({
      archivedAt: new Date(),
      archivedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();

  if (!archived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ document: archived });
}

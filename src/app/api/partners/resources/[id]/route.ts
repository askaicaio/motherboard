// PUT    /api/partners/resources/[id] — replace the file (upload new version)
// PATCH  /api/partners/resources/[id] — edit metadata (admin)
// DELETE /api/partners/resources/[id] — archive (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { partnerResources } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Replace the underlying file with a newly-uploaded version, keeping the same
// row (title/category/visibility/URL slot). Uploads the new blob, points the
// row at it, then best-effort deletes the superseded blob so they don't pile up.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(partnerResources)
    .where(eq(partnerResources.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let fileUrl: string;
  try {
    const blob = await put(`partner-resources/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    fileUrl = blob.url;
  } catch (err) {
    console.error("[resources] blob replace failed:", err);
    return NextResponse.json(
      { error: "File upload failed. Check the Blob store is connected." },
      { status: 502 },
    );
  }

  const [updated] = await db
    .update(partnerResources)
    .set({
      fileUrl,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      // Replacing with a file supersedes any prior external link.
      externalUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(partnerResources.id, id))
    .returning();

  // Best-effort cleanup of the old blob (only when it was a stored file, not a
  // link, and the URL actually changed).
  if (existing.fileUrl && existing.fileUrl !== fileUrl) {
    try {
      await del(existing.fileUrl);
    } catch {
      // orphan cleanup is non-critical
    }
  }

  return NextResponse.json({ resource: updated });
}

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

// GET  /api/partners/resources — list (admin: all; ?public=1: public only)
// POST /api/partners/resources — create a resource (admin)
//   - multipart/form-data with `file` → uploaded to Vercel Blob
//   - application/json with `externalUrl` → linked asset
//
// Used by the admin Resources manager. The public affiliate page queries
// the DB directly for is_public rows.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { partnerResources } from "@/lib/db/schema";
import { requireRole, getOptionalAuth } from "@/lib/auth/guard";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CATEGORIES = [
  "playbook",
  "toolkit",
  "brand_asset",
  "email_template",
  "social_post",
  "banner",
  "other",
] as const;

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicOnly = request.nextUrl.searchParams.get("public") === "1";

  const rows = await db
    .select()
    .from(partnerResources)
    .where(
      publicOnly
        ? and(isNull(partnerResources.archivedAt), eq(partnerResources.isPublic, true))
        : isNull(partnerResources.archivedAt),
    )
    .orderBy(asc(partnerResources.sortOrder), desc(partnerResources.createdAt));

  return NextResponse.json({ resources: rows });
}

const jsonSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(CATEGORIES).optional().default("other"),
  externalUrl: z.string().url(),
  isPublic: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  const user = await requireRole("admin");
  const contentType = request.headers.get("content-type") || "";

  try {
    // ---- Linked external asset (JSON) ----
    if (contentType.includes("application/json")) {
      const body = jsonSchema.parse(await request.json());
      const [created] = await db
        .insert(partnerResources)
        .values({
          title: body.title.trim(),
          description: body.description?.trim() || null,
          category: body.category,
          externalUrl: body.externalUrl.trim(),
          isPublic: body.isPublic,
          createdBy: user.id,
        })
        .returning();
      return NextResponse.json({ resource: created }, { status: 201 });
    }

    // ---- Uploaded file (multipart) ----
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "other");
    const isPublic = String(form.get("isPublic") ?? "true") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let fileUrl: string;
    try {
      const blob = await put(
        `partner-resources/${Date.now()}-${file.name}`,
        file,
        { access: "public", addRandomSuffix: true },
      );
      fileUrl = blob.url;
    } catch (err) {
      console.error("[resources] blob upload failed:", err);
      return NextResponse.json(
        {
          error:
            "File upload failed. Connect a Vercel Blob store (Storage → Blob) so BLOB_READ_WRITE_TOKEN is set, or add the resource as an external link instead.",
        },
        { status: 502 },
      );
    }

    const [created] = await db
      .insert(partnerResources)
      .values({
        title,
        description: description || null,
        category: (CATEGORIES as readonly string[]).includes(category)
          ? category
          : "other",
        fileUrl,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        isPublic,
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json({ resource: created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

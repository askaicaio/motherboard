// GET  /api/documents  — list active (or archived) docs
// POST /api/documents  — create a new doc entry

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { desc, isNull, isNotNull } from "drizzle-orm";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url().max(2000),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(60)).max(50).optional().default([]),
  pinned: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const archived = request.nextUrl.searchParams.get("archived") === "1";

  const rows = await db
    .select()
    .from(documents)
    .where(archived ? isNotNull(documents.archivedAt) : isNull(documents.archivedAt))
    .orderBy(desc(documents.pinned), desc(documents.createdAt));

  return NextResponse.json({ documents: rows });
}

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .insert(documents)
    .values({
      title: body.title.trim(),
      url: body.url.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      tags: body.tags.map((t) => t.trim()).filter(Boolean),
      pinned: body.pinned,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ document: created }, { status: 201 });
}

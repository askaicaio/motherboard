// POST /api/partners/programs/[id]/restore — un-archive a program (admin only).
// Clears archivedAt. The program stays inactive until explicitly re-activated
// via PATCH, so restoring never silently re-exposes it to affiliates.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;

  const [restored] = await db
    .update(partnerPrograms)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(partnerPrograms.id, id))
    .returning();

  if (!restored) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ program: restored });
}

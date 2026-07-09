// DELETE /api/automations/errors/[id] — hard-delete a single captured error row.
//
// Used by the Error History page's Edit mode (delete-only). Auth required.
// NOTE: this is a HARD delete (user's choice) — if the same error is still in
// Make's logs, the next background sweep can re-capture it. Deletes are not
// permanent for errors still within Make's retention window.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationErrors } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(automationErrors)
    .where(eq(automationErrors.id, id))
    .returning({ id: automationErrors.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: deleted.id });
}

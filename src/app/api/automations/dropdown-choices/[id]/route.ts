// PATCH  /api/automations/dropdown-choices/[id] — rename an option
// DELETE /api/automations/dropdown-choices/[id] — remove an option

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationDropdownChoices } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  value: z.string().trim().min(1).max(300),
});

const DUPLICATE_ERROR = "That option already exists in this column.";

function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "23505"
    ) {
      return true;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

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

  const value = body.value.trim();

  // Need the row's column to scope the duplicate check to that column.
  const [row] = await db
    .select({ columnKey: automationDropdownChoices.columnKey })
    .from(automationDropdownChoices)
    .where(eq(automationDropdownChoices.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clash = await db
    .select({ id: automationDropdownChoices.id })
    .from(automationDropdownChoices)
    .where(
      and(
        eq(automationDropdownChoices.columnKey, row.columnKey),
        eq(automationDropdownChoices.value, value),
        ne(automationDropdownChoices.id, id),
      ),
    )
    .limit(1);
  if (clash.length > 0) {
    return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
  }

  try {
    const [updated] = await db
      .update(automationDropdownChoices)
      .set({ value, updatedAt: new Date() })
      .where(eq(automationDropdownChoices.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      choice: {
        id: updated.id,
        columnKey: updated.columnKey,
        value: updated.value,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(automationDropdownChoices)
    .where(eq(automationDropdownChoices.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ choice: { id: deleted.id } });
}

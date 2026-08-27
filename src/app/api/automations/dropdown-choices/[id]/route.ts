// PATCH  /api/automations/dropdown-choices/[id] — rename an option
// DELETE /api/automations/dropdown-choices/[id] — remove an option

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationDropdownChoices } from "@/lib/db/schema";
import {
  DROPDOWN_COLUMNS,
  CHOICE_COLOR_KEYS,
  isSpecialChoice,
} from "@/lib/automations/dropdown-config";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  value: z.string().trim().min(1).max(300).optional(),
  // Status/notes-bearing columns only (GHL Tags, GHL Forms, Author). Status is
  // validated per-column below against the row's own column set.
  status: z.string().trim().max(50).optional(),
  notes: z.string().max(5000).optional(),
  // Colour-bearing columns only (Trigger Event); null clears. Validated below.
  badgeColor: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
});

const DUPLICATE_ERROR = "That option already exists in this column.";
const SPECIAL_DELETE_ERROR =
  "This is a built-in option and cannot be removed.";
const SPECIAL_RENAME_ERROR =
  "This is a built-in option and cannot be renamed.";

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

  // Need the row's column to scope the duplicate check to that column, and its
  // current value to spot a built-in option.
  const [row] = await db
    .select({
      columnKey: automationDropdownChoices.columnKey,
      value: automationDropdownChoices.value,
    })
    .from(automationDropdownChoices)
    .where(eq(automationDropdownChoices.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A built-in option is recognised BY ITS VALUE, so renaming one would leave
  // the row in place while quietly turning it into an ordinary choice. Blocked
  // for the same reason deleting it is. Status and Notes stay editable, since
  // neither carries the identity.
  if (
    body.value !== undefined &&
    isSpecialChoice(row.columnKey, row.value) &&
    body.value.trim() !== row.value
  ) {
    return NextResponse.json({ error: SPECIAL_RENAME_ERROR }, { status: 409 });
  }

  // A provided status must belong to THIS row's column set (per-column).
  if (body.status !== undefined) {
    const column = DROPDOWN_COLUMNS.find((c) => c.key === row.columnKey);
    const allowed = (column?.statusOptions ?? []).map((o) => o.value);
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status for this column." },
        { status: 400 },
      );
    }
  }

  // A provided colour (badge/text), when non-null, must be a valid palette key.
  for (const c of [body.badgeColor, body.textColor]) {
    if (c && !CHOICE_COLOR_KEYS.includes(c)) {
      return NextResponse.json(
        { error: "Invalid colour for this column." },
        { status: 400 },
      );
    }
  }

  // Duplicate check only when the value (the option text) is changing.
  if (body.value !== undefined) {
    const value = body.value.trim();
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
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.value !== undefined) patch.value = body.value.trim();
  if (body.status !== undefined) patch.status = body.status;
  if (body.notes !== undefined) patch.notes = body.notes.trim() || null;
  if (body.badgeColor !== undefined) patch.badgeColor = body.badgeColor || null;
  if (body.textColor !== undefined) patch.textColor = body.textColor || null;

  try {
    const [updated] = await db
      .update(automationDropdownChoices)
      .set(patch)
      .where(eq(automationDropdownChoices.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      choice: {
        id: updated.id,
        columnKey: updated.columnKey,
        value: updated.value,
        status: updated.status,
        notes: updated.notes,
        badgeColor: updated.badgeColor,
        textColor: updated.textColor,
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

  // Built-in options ("No Tag", "No Form") are permanent. Checked BEFORE the
  // delete rather than relying on the config page hiding its own bin icon: the
  // UI is a courtesy, this is the actual rule.
  const [row] = await db
    .select({
      columnKey: automationDropdownChoices.columnKey,
      value: automationDropdownChoices.value,
    })
    .from(automationDropdownChoices)
    .where(eq(automationDropdownChoices.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isSpecialChoice(row.columnKey, row.value)) {
    return NextResponse.json({ error: SPECIAL_DELETE_ERROR }, { status: 409 });
  }

  const [deleted] = await db
    .delete(automationDropdownChoices)
    .where(eq(automationDropdownChoices.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ choice: { id: deleted.id } });
}

// POST /api/automations/dropdown-choices — create an option for one of the
// five generic dropdown columns (Author, Automation Tags, GHL Tags, GHL Forms,
// Trigger Event). Backs the "Add Option" action on the Dropdown Configuration
// page.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationDropdownChoices } from "@/lib/db/schema";
import { DROPDOWN_COLUMNS } from "@/lib/automations/dropdown-config";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq } from "drizzle-orm";

const createSchema = z.object({
  columnKey: z.enum([
    "author",
    "automation_tags",
    "ghl_tags",
    "ghl_forms",
    "trigger_event",
  ]),
  value: z.string().trim().min(1).max(300),
  // Status + Notes only apply to GHL Tags; ignored (stored null) for the others.
  status: z.enum(["Keep", "To Remove", "Unknown", "Removed"]).optional(),
  notes: z.string().max(5000).optional(),
});

const DUPLICATE_ERROR = "That option already exists in this column.";

/**
 * Postgres unique-constraint violation (duplicate (column_key, value)).
 * Drizzle wraps the driver error, so the SQLSTATE `code` can sit on `.cause`.
 */
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

  const value = body.value.trim();

  // Deterministic duplicate check within the same column.
  const existing = await db
    .select({ id: automationDropdownChoices.id })
    .from(automationDropdownChoices)
    .where(
      and(
        eq(automationDropdownChoices.columnKey, body.columnKey),
        eq(automationDropdownChoices.value, value),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
  }

  // Status + Notes apply to columns configured with them (GHL Tags, GHL Forms).
  // Those default a new entry's status to 'Unknown'; other columns store null.
  const column = DROPDOWN_COLUMNS.find((c) => c.key === body.columnKey);
  try {
    const [created] = await db
      .insert(automationDropdownChoices)
      .values({
        columnKey: body.columnKey,
        value,
        status: column?.hasStatus ? body.status ?? "Unknown" : null,
        notes: column?.hasNotes ? body.notes?.trim() || null : null,
        createdBy: user.id,
      })
      .returning();
    return NextResponse.json(
      {
        choice: {
          id: created.id,
          columnKey: created.columnKey,
          value: created.value,
          status: created.status,
          notes: created.notes,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // Backstop for a race between the check above and the insert.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
    }
    throw err;
  }
}

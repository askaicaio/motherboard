// PATCH /api/automations/[id], partial update of an automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automations, automationDropdownChoices } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  // Name is optional (may be set to ""); Link must be a valid URL when present.
  name: z.string().max(300).optional(),
  externalUrl: z.string().url().max(1000).optional(),
  status: z.enum(["active", "paused"]).optional(),
  // Purpose is optional free text; stored as null when blank.
  purpose: z.string().max(5000).optional(),
  // Notes is optional free text (mirrors Purpose); stored as null when blank.
  notes: z.string().max(5000).optional(),
  // Author (single-select): the chosen automation_dropdown_choices id, or null
  // to clear it. Only applied when the key is present. Validated below.
  authorChoiceId: z.string().uuid().nullable().optional(),
});

const UNKNOWN_AUTHOR_ERROR = "Unknown author option.";

/** True when `id` is a real Author option (column_key = 'author'). Guards the
 *  FK against a valid-but-wrong-column choice id. */
async function isAuthorChoice(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: automationDropdownChoices.id })
    .from(automationDropdownChoices)
    .where(
      and(
        eq(automationDropdownChoices.id, id),
        eq(automationDropdownChoices.columnKey, "author"),
      ),
    )
    .limit(1);
  return !!row;
}

const DUPLICATE_LINK_ERROR = "An automation with that link already exists.";

/**
 * Postgres unique-constraint violation (e.g. duplicate external_url).
 * Drizzle (v0.45) wraps the driver error, so the real Postgres error, with
 * the SQLSTATE `code`, can sit on `.cause`. Walk the chain to find 23505.
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

  // Reject an author id that isn't a real 'author' option (null clears it and
  // needs no check).
  if (
    body.authorChoiceId != null &&
    !(await isAuthorChoice(body.authorChoiceId))
  ) {
    return NextResponse.json({ error: UNKNOWN_AUTHOR_ERROR }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.externalUrl !== undefined) patch.externalUrl = body.externalUrl.trim();
  if (body.status !== undefined) patch.status = body.status;
  if (body.purpose !== undefined) patch.purpose = body.purpose.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes.trim() || null;
  if (body.authorChoiceId !== undefined) patch.authorChoiceId = body.authorChoiceId;

  // Deterministic duplicate check, block if ANOTHER row already uses this
  // link (the link is the automation's identity). Excludes the row itself.
  if (typeof patch.externalUrl === "string") {
    const clash = await db
      .select({ id: automations.id })
      .from(automations)
      .where(
        and(eq(automations.externalUrl, patch.externalUrl), ne(automations.id, id)),
      )
      .limit(1);
    if (clash.length > 0) {
      return NextResponse.json({ error: DUPLICATE_LINK_ERROR }, { status: 409 });
    }
  }

  try {
    const [updated] = await db
      .update(automations)
      .set(patch)
      .where(eq(automations.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ automation: updated });
  } catch (err) {
    // Backstop for a race between the check above and the update.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_LINK_ERROR }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/automations/[id], hard delete (permanently removes the row).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(automations)
    .where(eq(automations.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ automation: deleted });
}

// PATCH /api/automations/[id] — partial update of an automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  // Name is optional (may be set to ""); Link must be a valid URL when present.
  name: z.string().max(300).optional(),
  externalUrl: z.string().url().max(1000).optional(),
});

const DUPLICATE_LINK_ERROR = "An automation with that link already exists.";

/**
 * Postgres unique-constraint violation (e.g. duplicate external_url).
 * Drizzle (v0.45) wraps the driver error, so the real Postgres error — with
 * the SQLSTATE `code` — can sit on `.cause`. Walk the chain to find 23505.
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

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.externalUrl !== undefined) patch.externalUrl = body.externalUrl.trim();

  // Deterministic duplicate check — block if ANOTHER row already uses this
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

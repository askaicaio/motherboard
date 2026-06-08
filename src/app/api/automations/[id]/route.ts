// PATCH /api/automations/[id] — partial update of an automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  externalUrl: z.string().url().max(1000).optional(),
});

/** Postgres unique-constraint violation (e.g. duplicate external_url). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
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

  try {
    const [updated] = await db
      .update(automations)
      .set(patch)
      .where(eq(automations.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ automation: updated });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "An automation with that link already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}

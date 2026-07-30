// PATCH  /api/automations/webhook-choices/[id] — edit a webhook URL
// DELETE /api/automations/webhook-choices/[id] — remove a webhook URL

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationWebhookChoices } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  url: z.string().url().max(1000),
  // Optional free-text note; only applied when the key is present. Blank → null.
  notes: z.string().max(5000).optional(),
});

const DUPLICATE_ERROR = "That webhook URL already exists.";

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

  const url = body.url.trim();

  const clash = await db
    .select({ id: automationWebhookChoices.id })
    .from(automationWebhookChoices)
    .where(
      and(eq(automationWebhookChoices.url, url), ne(automationWebhookChoices.id, id)),
    )
    .limit(1);
  if (clash.length > 0) {
    return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
  }

  const patch: Record<string, unknown> = { url, updatedAt: new Date() };
  if (body.notes !== undefined) patch.notes = body.notes.trim() || null;

  try {
    const [updated] = await db
      .update(automationWebhookChoices)
      .set(patch)
      .where(eq(automationWebhookChoices.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      webhook: { id: updated.id, url: updated.url, notes: updated.notes },
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
    .delete(automationWebhookChoices)
    .where(eq(automationWebhookChoices.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ webhook: { id: deleted.id } });
}

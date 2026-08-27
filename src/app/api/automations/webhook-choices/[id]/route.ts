// PATCH  /api/automations/webhook-choices/[id] — edit a webhook URL
// DELETE /api/automations/webhook-choices/[id] — remove a webhook URL

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationWebhookChoices } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import {
  WEBHOOK_SCOPE,
  isSpecialChoice,
} from "@/lib/automations/dropdown-config";
import { and, eq, ne } from "drizzle-orm";

const patchSchema = z.object({
  // A real URL, OR one of the built-in Webhook Links options, whose whole point
  // is that they are NOT URLs ("No Path", "No Webhook"). Without this the
  // config page could not save an edit to a built-in row at all: its own url
  // fails `.url()`, so even a Notes-only change is rejected before it starts.
  // Creating one is still impossible (POST stays URL-only), and every special
  // value already exists, so the unique index stops this being a back door to
  // renaming an ordinary webhook into one.
  url: z
    .string()
    .max(1000)
    .refine((v) => isSpecialChoice(WEBHOOK_SCOPE, v) || isHttpUrl(v), {
      message: "Enter a valid URL (including https://)",
    }),
  // Optional free-text note; only applied when the key is present. Blank → null.
  notes: z.string().max(5000).optional(),
});

function isHttpUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const DUPLICATE_ERROR = "That webhook URL already exists.";
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

  const url = body.url.trim();

  // Built-in options are recognised BY VALUE, so a rename would leave the row
  // in place while quietly turning it into an ordinary webhook. Blocked for the
  // same reason deleting it is; Notes stay editable.
  const [current] = await db
    .select({ url: automationWebhookChoices.url })
    .from(automationWebhookChoices)
    .where(eq(automationWebhookChoices.id, id))
    .limit(1);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isSpecialChoice(WEBHOOK_SCOPE, current.url) && url !== current.url) {
    return NextResponse.json({ error: SPECIAL_RENAME_ERROR }, { status: 409 });
  }

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

  // Built-in options ("No Path", "No Webhook") are permanent. Checked BEFORE
  // the delete rather than relying on the config page hiding its own bin icon:
  // the UI is a courtesy, this is the actual rule.
  const [row] = await db
    .select({ url: automationWebhookChoices.url })
    .from(automationWebhookChoices)
    .where(eq(automationWebhookChoices.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isSpecialChoice(WEBHOOK_SCOPE, row.url)) {
    return NextResponse.json({ error: SPECIAL_DELETE_ERROR }, { status: 409 });
  }

  const [deleted] = await db
    .delete(automationWebhookChoices)
    .where(eq(automationWebhookChoices.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ webhook: { id: deleted.id } });
}

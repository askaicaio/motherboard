// POST /api/automations/webhook-choices — create a webhook URL choice.
// Backs the "Add Option" action on the Webhook Links table of the Dropdown
// Configuration page. (The automation<->webhook relationships/junction is a
// later item; this endpoint only manages the URL list.)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automationWebhookChoices } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const createSchema = z.object({
  url: z.string().url().max(1000),
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

  const url = body.url.trim();

  const existing = await db
    .select({ id: automationWebhookChoices.id })
    .from(automationWebhookChoices)
    .where(eq(automationWebhookChoices.url, url))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
  }

  try {
    const [created] = await db
      .insert(automationWebhookChoices)
      .values({ url, createdBy: user.id })
      .returning();
    return NextResponse.json(
      { webhook: { id: created.id, url: created.url } },
      { status: 201 },
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_ERROR }, { status: 409 });
    }
    throw err;
  }
}

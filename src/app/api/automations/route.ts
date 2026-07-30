// GET  /api/automations, list (optionally filtered by ?platform=<slug>)
// POST /api/automations, create a new automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  automations,
  automationDropdownChoices,
  automationDropdownSelections,
} from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, asc, eq } from "drizzle-orm";
import { getAutomationSite } from "@/lib/automations/sites";

const createSchema = z.object({
  // platform must be one of the known website slugs (single source of truth)
  platform: z
    .string()
    .refine((s) => !!getAutomationSite(s), { message: "Unknown platform" }),
  // Name is optional (stored as "" when omitted); Link is required.
  name: z.string().max(300).optional().default(""),
  externalUrl: z.string().url().max(1000),
  status: z.enum(["active", "paused"]).optional().default("paused"),
  // Purpose is optional free text; stored as null when blank.
  purpose: z.string().max(5000).optional().default(""),
  // Notes is optional free text (mirrors Purpose); stored as null when blank.
  notes: z.string().max(5000).optional().default(""),
  // Author (single-select): the chosen automation_dropdown_choices id, or null
  // for none. Validated below to be a real 'author' option.
  authorChoiceId: z.string().uuid().nullable().optional(),
  // Trigger Event (single-select): the chosen id, or null. Validated below to
  // be a real 'trigger_event' option.
  triggerEventChoiceId: z.string().uuid().nullable().optional(),
  // Automation Tags (MULTI-select): the chosen automation_dropdown_choices ids
  // (column_key = 'automation_tags'). Each validated below; empty = no tags.
  automationTagChoiceIds: z.array(z.string().uuid()).optional().default([]),
});

/** True when `id` is a real option for `columnKey` in automation_dropdown_choices.
 *  Guards a single-select FK against a valid-but-wrong-column choice id. */
async function isChoiceOfColumn(id: string, columnKey: string): Promise<boolean> {
  const [row] = await db
    .select({ id: automationDropdownChoices.id })
    .from(automationDropdownChoices)
    .where(
      and(
        eq(automationDropdownChoices.id, id),
        eq(automationDropdownChoices.columnKey, columnKey),
      ),
    )
    .limit(1);
  return !!row;
}

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

const DUPLICATE_LINK_ERROR = "An automation with that link already exists.";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = request.nextUrl.searchParams.get("platform");
  const rows = await db
    .select()
    .from(automations)
    .where(platform ? eq(automations.platform, platform) : undefined)
    .orderBy(asc(automations.name));

  return NextResponse.json({ automations: rows });
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

  const externalUrl = body.externalUrl.trim();

  // Reject a single-select id that isn't a real option for its column (the FK
  // alone would also allow a choice from another column).
  if (body.authorChoiceId && !(await isChoiceOfColumn(body.authorChoiceId, "author"))) {
    return NextResponse.json({ error: "Unknown author option." }, { status: 400 });
  }
  if (
    body.triggerEventChoiceId &&
    !(await isChoiceOfColumn(body.triggerEventChoiceId, "trigger_event"))
  ) {
    return NextResponse.json({ error: "Unknown trigger event option." }, { status: 400 });
  }

  // Automation Tags (multi-select): dedupe, then reject any id that isn't a real
  // 'automation_tags' option.
  const tagChoiceIds = [...new Set(body.automationTagChoiceIds)];
  for (const tagId of tagChoiceIds) {
    if (!(await isChoiceOfColumn(tagId, "automation_tags"))) {
      return NextResponse.json(
        { error: "Unknown automation tag option." },
        { status: 400 },
      );
    }
  }

  // Deterministic duplicate check (the link is the automation's identity).
  const existing = await db
    .select({ id: automations.id })
    .from(automations)
    .where(eq(automations.externalUrl, externalUrl))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: DUPLICATE_LINK_ERROR }, { status: 409 });
  }

  try {
    // Create the automation and its tag selections atomically.
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(automations)
        .values({
          platform: body.platform,
          name: body.name.trim(),
          externalUrl,
          status: body.status,
          purpose: body.purpose.trim() || null,
          notes: body.notes.trim() || null,
          authorChoiceId: body.authorChoiceId ?? null,
          triggerEventChoiceId: body.triggerEventChoiceId ?? null,
          createdBy: user.id,
        })
        .returning();
      if (tagChoiceIds.length > 0) {
        await tx.insert(automationDropdownSelections).values(
          tagChoiceIds.map((choiceId) => ({ automationId: row.id, choiceId })),
        );
      }
      return row;
    });
    return NextResponse.json({ automation: created }, { status: 201 });
  } catch (err) {
    // Backstop for a race between the check above and the insert.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_LINK_ERROR }, { status: 409 });
    }
    throw err;
  }
}

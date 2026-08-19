// PATCH /api/automations/[id], partial update of an automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  automations,
  automationDropdownChoices,
  automationDropdownSelections,
  automationWebhooks,
  automationWebhookChoices,
} from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { and, eq, inArray, ne } from "drizzle-orm";

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
  // Trigger Event (single-select): the chosen id, or null to clear it. Only
  // applied when present. Validated below.
  triggerEventChoiceId: z.string().uuid().nullable().optional(),
  triageChoiceId: z.string().uuid().nullable().optional(),

  // Automation Tags (MULTI-select): the FULL desired set of tag choice ids.
  // Only synced when the key is present (absent = leave tags untouched). Each
  // validated below.
  automationTagChoiceIds: z.array(z.string().uuid()).optional(),
  // GHL Tags + GHL Forms (MULTI-select, GHL pages): the FULL desired set for each.
  // Only synced when present (absent = leave untouched; the dialog omits them on
  // non-GHL platforms, so those rows are never wiped). Each validated below.
  ghlTagChoiceIds: z.array(z.string().uuid()).optional(),
  ghlFormChoiceIds: z.array(z.string().uuid()).optional(),
  // Webhook Links (MULTI-select): the FULL desired set of webhook choice ids.
  // Only synced when the key is present (absent = leave webhooks untouched).
  webhookChoiceIds: z.array(z.string().uuid()).optional(),
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

/** True when `id` is a real webhook choice (automation_webhook_choices). */
async function isWebhookChoice(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: automationWebhookChoices.id })
    .from(automationWebhookChoices)
    .where(eq(automationWebhookChoices.id, id))
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

  // Reject a single-select id that isn't a real option for its column (null
  // clears it and needs no check).
  if (
    body.authorChoiceId != null &&
    !(await isChoiceOfColumn(body.authorChoiceId, "author"))
  ) {
    return NextResponse.json({ error: "Unknown author option." }, { status: 400 });
  }
  if (
    body.triggerEventChoiceId != null &&
    !(await isChoiceOfColumn(body.triggerEventChoiceId, "trigger_event"))
  ) {
    return NextResponse.json({ error: "Unknown trigger event option." }, { status: 400 });
  }
  if (
    body.triageChoiceId != null &&
    !(await isChoiceOfColumn(body.triageChoiceId, "triage"))
  ) {
    return NextResponse.json({ error: "Unknown evaluation option." }, { status: 400 });

  }

  // Automation Tags (multi-select): validate each provided id when the key is
  // present (absent leaves the tags untouched).
  if (body.automationTagChoiceIds !== undefined) {
    for (const tagId of body.automationTagChoiceIds) {
      if (!(await isChoiceOfColumn(tagId, "automation_tags"))) {
        return NextResponse.json(
          { error: "Unknown automation tag option." },
          { status: 400 },
        );
      }
    }
  }
  // GHL Tags + GHL Forms (multi-select): validate each provided id when present.
  if (body.ghlTagChoiceIds !== undefined) {
    for (const id of body.ghlTagChoiceIds) {
      if (!(await isChoiceOfColumn(id, "ghl_tags"))) {
        return NextResponse.json({ error: "Unknown GHL tag option." }, { status: 400 });
      }
    }
  }
  if (body.ghlFormChoiceIds !== undefined) {
    for (const id of body.ghlFormChoiceIds) {
      if (!(await isChoiceOfColumn(id, "ghl_forms"))) {
        return NextResponse.json({ error: "Unknown GHL form option." }, { status: 400 });
      }
    }
  }
  // Webhook Links (multi-select): validate each provided id when present.
  if (body.webhookChoiceIds !== undefined) {
    for (const wid of body.webhookChoiceIds) {
      if (!(await isWebhookChoice(wid))) {
        return NextResponse.json({ error: "Unknown webhook option." }, { status: 400 });
      }
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.externalUrl !== undefined) patch.externalUrl = body.externalUrl.trim();
  if (body.status !== undefined) patch.status = body.status;
  if (body.purpose !== undefined) patch.purpose = body.purpose.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes.trim() || null;
  if (body.authorChoiceId !== undefined) patch.authorChoiceId = body.authorChoiceId;
  if (body.triggerEventChoiceId !== undefined)
    patch.triggerEventChoiceId = body.triggerEventChoiceId;
  if (body.triageChoiceId !== undefined)
    patch.triageChoiceId = body.triageChoiceId;


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
    // Update the automation and (when provided) re-sync its tag selections
    // atomically. Absent automationTagChoiceIds leaves the tags untouched.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(automations)
        .set(patch)
        .where(eq(automations.id, id))
        .returning();
      if (!row) return null;

      if (body.automationTagChoiceIds !== undefined) {
        const tagChoiceIds = [...new Set(body.automationTagChoiceIds)];
        // Scope the wipe to the Automation Tags column's choices, so other
        // multi-select columns' selections for this automation are untouched.
        const tagColumnChoices = await tx
          .select({ id: automationDropdownChoices.id })
          .from(automationDropdownChoices)
          .where(eq(automationDropdownChoices.columnKey, "automation_tags"));
        const tagColumnIds = tagColumnChoices.map((c) => c.id);
        if (tagColumnIds.length > 0) {
          await tx
            .delete(automationDropdownSelections)
            .where(
              and(
                eq(automationDropdownSelections.automationId, id),
                inArray(automationDropdownSelections.choiceId, tagColumnIds),
              ),
            );
        }
        if (tagChoiceIds.length > 0) {
          await tx
            .insert(automationDropdownSelections)
            .values(
              tagChoiceIds.map((choiceId) => ({ automationId: id, choiceId })),
            );
        }
      }

      // GHL Tags + GHL Forms: same column-scoped wipe + re-insert as Automation
      // Tags (they share the generic selections junction, so the wipe MUST be
      // scoped to each column's own choice ids or they'd clobber each other).
      if (body.ghlTagChoiceIds !== undefined) {
        const ids = [...new Set(body.ghlTagChoiceIds)];
        const columnChoices = await tx
          .select({ id: automationDropdownChoices.id })
          .from(automationDropdownChoices)
          .where(eq(automationDropdownChoices.columnKey, "ghl_tags"));
        const columnIds = columnChoices.map((c) => c.id);
        if (columnIds.length > 0) {
          await tx
            .delete(automationDropdownSelections)
            .where(
              and(
                eq(automationDropdownSelections.automationId, id),
                inArray(automationDropdownSelections.choiceId, columnIds),
              ),
            );
        }
        if (ids.length > 0) {
          await tx
            .insert(automationDropdownSelections)
            .values(ids.map((choiceId) => ({ automationId: id, choiceId })));
        }
      }
      if (body.ghlFormChoiceIds !== undefined) {
        const ids = [...new Set(body.ghlFormChoiceIds)];
        const columnChoices = await tx
          .select({ id: automationDropdownChoices.id })
          .from(automationDropdownChoices)
          .where(eq(automationDropdownChoices.columnKey, "ghl_forms"));
        const columnIds = columnChoices.map((c) => c.id);
        if (columnIds.length > 0) {
          await tx
            .delete(automationDropdownSelections)
            .where(
              and(
                eq(automationDropdownSelections.automationId, id),
                inArray(automationDropdownSelections.choiceId, columnIds),
              ),
            );
        }
        if (ids.length > 0) {
          await tx
            .insert(automationDropdownSelections)
            .values(ids.map((choiceId) => ({ automationId: id, choiceId })));
        }
      }

      if (body.webhookChoiceIds !== undefined) {
        const webhookChoiceIds = [...new Set(body.webhookChoiceIds)];
        // The automation_webhooks junction only holds webhook links, so wipe all
        // of this automation's rows then re-insert the desired set.
        await tx
          .delete(automationWebhooks)
          .where(eq(automationWebhooks.automationId, id));
        if (webhookChoiceIds.length > 0) {
          await tx.insert(automationWebhooks).values(
            webhookChoiceIds.map((webhookChoiceId) => ({
              automationId: id,
              webhookChoiceId,
            })),
          );
        }
      }
      return row;
    });

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

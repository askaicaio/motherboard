// GET  /api/automations — list (optionally filtered by ?platform=<slug>)
// POST /api/automations — create a new automation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { asc, eq } from "drizzle-orm";
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
});

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
    const [created] = await db
      .insert(automations)
      .values({
        platform: body.platform,
        name: body.name.trim(),
        externalUrl,
        status: body.status,
        createdBy: user.id,
      })
      .returning();
    return NextResponse.json({ automation: created }, { status: 201 });
  } catch (err) {
    // Backstop for a race between the check above and the insert.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: DUPLICATE_LINK_ERROR }, { status: 409 });
    }
    throw err;
  }
}

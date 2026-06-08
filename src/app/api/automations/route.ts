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
  name: z.string().min(1).max(300),
  externalUrl: z.string().url().max(1000),
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

  try {
    const [created] = await db
      .insert(automations)
      .values({
        platform: body.platform,
        name: body.name.trim(),
        externalUrl: body.externalUrl.trim(),
        createdBy: user.id,
      })
      .returning();
    return NextResponse.json({ automation: created }, { status: 201 });
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

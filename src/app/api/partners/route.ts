// GET  /api/partners — list all partners (admin)
// POST /api/partners — create a new partner in 'applied' status (admin)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { generateRefCode } from "@/lib/partners/rules";
import { desc } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1).max(300),
  email: z.string().email().max(320),
  company: z.string().max(300).nullable().optional(),
});

export async function GET() {
  await requireRole("admin");

  const rows = await db
    .select()
    .from(partners)
    .orderBy(desc(partners.createdAt));

  return NextResponse.json({ partners: rows });
}

export async function POST(request: NextRequest) {
  await requireRole("admin");

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

  // refCode is NOT NULL + unique, so generate one at creation time and
  // retry up to 5x on a unique-violation collision.
  let created;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      [created] = await db
        .insert(partners)
        .values({
          refCode: generateRefCode(),
          name: body.name.trim(),
          email: body.email.toLowerCase().trim(),
          company: body.company?.trim() || null,
          status: "applied",
        })
        .returning();
      break;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string }).code;
      // 23505 = unique_violation. Retry only on refCode collisions.
      if (code === "23505" && /ref_code/.test(String(err))) continue;
      throw err;
    }
  }

  if (!created) {
    throw lastErr ?? new Error("Failed to create partner");
  }

  return NextResponse.json({ partner: created }, { status: 201 });
}

// POST /api/portal/change-password — authenticated affiliate replaces their
// temporary password with one of their own. Clears the mustChangePassword flag.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPartnerSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    newPassword: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    throw err;
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(body.newPassword, 10);

  await db
    .update(partners)
    .set({
      passwordHash,
      mustChangePassword: false,
      portalLastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(partners.id, partner.id));

  return NextResponse.json({ ok: true });
}

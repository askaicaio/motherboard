// =============================================================
// GET  /api/partners/[id]/messages — a partner's chat thread (staff)
// POST /api/partners/[id]/messages — CAIO team replies (as self or "CAIO Team")
// =============================================================
// Staff inbox side. GET marks affiliate→CAIO messages read; POST records who
// actually sent it plus how it should be attributed to the affiliate.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerMessages, partners } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { and, asc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;

  const [partner] = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(partnerMessages)
    .where(eq(partnerMessages.partnerId, id))
    .orderBy(asc(partnerMessages.createdAt));

  // Mark affiliate→CAIO messages read.
  if (rows.some((r) => r.senderType === "partner" && r.readByAdminAt === null)) {
    await db
      .update(partnerMessages)
      .set({ readByAdminAt: new Date() })
      .where(
        and(
          eq(partnerMessages.partnerId, id),
          eq(partnerMessages.senderType, "partner"),
          isNull(partnerMessages.readByAdminAt),
        ),
      );
  }

  const messages = rows.map((r) => ({
    id: r.id,
    fromPartner: r.senderType === "partner",
    senderName:
      r.senderType === "partner"
        ? partner.name
        : r.displayAs === "caio_team"
          ? "CAIO Team"
          : r.authorName || "CAIO",
    sentAsTeam: r.senderType === "admin" && r.displayAs === "caio_team",
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ partner: { id: partner.id, name: partner.name }, messages });
}

const postSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  displayAs: z.enum(["admin", "caio_team"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("admin");
  const { id } = await params;

  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = postSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [created] = await db
    .insert(partnerMessages)
    .values({
      partnerId: id,
      senderType: "admin",
      authorAdminId: me.id,
      authorName: me.name ?? null,
      displayAs: parsed.displayAs,
      body: parsed.body,
      // A CAIO reply is read on the CAIO side by definition.
      readByAdminAt: new Date(),
    })
    .returning();

  return NextResponse.json(
    {
      message: {
        id: created.id,
        fromPartner: false,
        senderName: parsed.displayAs === "caio_team" ? "CAIO Team" : me.name || "CAIO",
        sentAsTeam: parsed.displayAs === "caio_team",
        body: created.body,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

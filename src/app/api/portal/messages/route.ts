// =============================================================
// GET  /api/portal/messages — this affiliate's chat thread with the CAIO team
// POST /api/portal/messages — affiliate sends a message
// =============================================================
// Scoped to the logged-in partner. GET marks CAIO→affiliate messages as read
// (unless a staff member is impersonating — a preview must not clear the real
// affiliate's unread). POST is blocked while impersonating.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerMessages } from "@/lib/db/schema";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { and, asc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface ClientMessage {
  id: string;
  fromPartner: boolean;
  senderName: string;
  body: string;
  createdAt: string;
}

function adminDisplayName(displayAs: string | null, authorName: string | null): string {
  if (displayAs === "admin" && authorName) return authorName;
  return "CAIO Team";
}

export async function GET(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const impersonating = await getImpersonation();

  // Peek mode: a closed widget polls just the unread count — never marks read.
  if (request.nextUrl.searchParams.get("peek") === "1") {
    const unreadRows = await db
      .select({ id: partnerMessages.id })
      .from(partnerMessages)
      .where(
        and(
          eq(partnerMessages.partnerId, partner.id),
          eq(partnerMessages.senderType, "admin"),
          isNull(partnerMessages.readByPartnerAt),
        ),
      );
    return NextResponse.json({ unread: unreadRows.length });
  }

  const rows = await db
    .select()
    .from(partnerMessages)
    .where(eq(partnerMessages.partnerId, partner.id))
    .orderBy(asc(partnerMessages.createdAt));

  // Mark CAIO→affiliate messages read — but never when an admin is previewing.
  if (!impersonating) {
    const hasUnread = rows.some(
      (r) => r.senderType === "admin" && r.readByPartnerAt === null,
    );
    if (hasUnread) {
      await db
        .update(partnerMessages)
        .set({ readByPartnerAt: new Date() })
        .where(
          and(
            eq(partnerMessages.partnerId, partner.id),
            eq(partnerMessages.senderType, "admin"),
            isNull(partnerMessages.readByPartnerAt),
          ),
        );
    }
  }

  const messages: ClientMessage[] = rows.map((r) => ({
    id: r.id,
    fromPartner: r.senderType === "partner",
    senderName:
      r.senderType === "partner"
        ? "You"
        : adminDisplayName(r.displayAs, r.authorName),
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ messages });
}

const postSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await getImpersonation()) {
    return NextResponse.json(
      { error: "Read-only while viewing as an affiliate." },
      { status: 403 },
    );
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
      partnerId: partner.id,
      senderType: "partner",
      body: parsed.body,
      isSample: partner.isSample,
    })
    .returning();

  return NextResponse.json(
    {
      message: {
        id: created.id,
        fromPartner: true,
        senderName: "You",
        body: created.body,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

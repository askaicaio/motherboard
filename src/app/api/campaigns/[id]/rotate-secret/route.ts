// POST /api/campaigns/[id]/rotate-secret — generate a fresh webhook secret.
// Use this if the URL has been leaked or after a clean-up.
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const newSecret = randomBytes(32).toString("base64url");

  const [updated] = await db
    .update(campaigns)
    .set({ webhookSecret: newSecret, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign: updated });
}

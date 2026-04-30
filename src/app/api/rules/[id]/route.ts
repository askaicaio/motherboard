import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { provisioningRules } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(provisioningRules)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(provisioningRules.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const user = session.user as SessionUser;
  await audit({
    action: "rule_updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { ruleId: id, changes: body },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Soft delete: deactivate
  const [deactivated] = await db
    .update(provisioningRules)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(provisioningRules.id, id))
    .returning();

  if (!deactivated) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const user = session.user as SessionUser;
  await audit({
    action: "rule_deleted",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { ruleId: id, ruleName: deactivated.name },
  });

  return NextResponse.json({ success: true });
}

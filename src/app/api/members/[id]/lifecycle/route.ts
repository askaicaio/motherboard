import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isAdminRole } from "@/lib/auth/permissions";
import { eq } from "drizzle-orm";

const lifecycleSchema = z.object({
  action: z.enum(["deactivate", "reactivate", "archive", "unarchive"]),
});

/**
 * POST /api/members/[id]/lifecycle
 * Body: { action: "deactivate" | "reactivate" | "archive" | "unarchive" }
 *
 * State semantics:
 *   - Active member:     isActive=true, archivedAt=null
 *   - Deactivated:       isActive=false, archivedAt=null  (still visible in main list)
 *   - Archived:          isActive=false, archivedAt=set    (moved to archive)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Only admins can change member status." }, { status: 403 });
  }

  let body;
  try {
    body = lifecycleSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    throw err;
  }

  const [member] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (member.id === user.id) {
    return NextResponse.json({ error: "You cannot change your own status." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  switch (body.action) {
    case "deactivate":
      update.isActive = false;
      update.archivedAt = null;
      break;
    case "reactivate":
      update.isActive = true;
      update.archivedAt = null;
      break;
    case "archive":
      update.isActive = false;
      update.archivedAt = new Date();
      update.archivedBy = user.id;
      break;
    case "unarchive":
      update.archivedAt = null;
      update.archivedBy = null;
      // After unarchive, member is still deactivated until reactivated
      break;
  }

  await db.update(adminUsers).set(update).where(eq(adminUsers.id, id));

  await audit({
    action: "settings_updated",
    actorId: user.id,
    actorEmail: user.email!,
    details: {
      kind: `member_${body.action}`,
      memberId: id,
      memberEmail: member.email,
    },
  });

  return NextResponse.json({ ok: true, action: body.action });
}

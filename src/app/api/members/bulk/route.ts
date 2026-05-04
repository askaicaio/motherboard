import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isAdminRole } from "@/lib/auth/permissions";
import { inArray } from "drizzle-orm";

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum([
    "update_role",
    "update_department",
    "deactivate",
    "reactivate",
    "archive",
    "unarchive",
  ]),
  /** Required for update_role */
  role: z.enum(["admin", "user"]).optional(),
  /** Required for update_department */
  department: z
    .enum([
      "operations",
      "caio_services",
      "sales",
      "marketing",
      "technology",
      "social_media",
      "podcast_support",
      "unassigned",
    ])
    .optional(),
});

/**
 * POST /api/members/bulk
 *
 * Apply an action to multiple members at once. Always excludes the
 * current user from destructive actions to prevent self-locks.
 *
 * Returns: { affected: number }
 */
export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json(
      { error: "Only admins can perform bulk actions." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = bulkSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  // Always exclude current user from bulk actions to prevent self-lock
  const ids = body.ids.filter((id) => id !== user.id);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No valid targets — you cannot bulk-modify yourself." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  let auditKind = "members_bulk_updated";

  switch (body.action) {
    case "update_role":
      if (!body.role) {
        return NextResponse.json({ error: "role is required" }, { status: 400 });
      }
      update.role = body.role === "admin" ? "admin" : "viewer";
      auditKind = "members_bulk_role_changed";
      break;
    case "update_department":
      if (!body.department) {
        return NextResponse.json(
          { error: "department is required" },
          { status: 400 },
        );
      }
      update.department = body.department;
      auditKind = "members_bulk_department_changed";
      break;
    case "deactivate":
      update.isActive = false;
      auditKind = "members_bulk_deactivated";
      break;
    case "reactivate":
      update.isActive = true;
      auditKind = "members_bulk_reactivated";
      break;
    case "archive":
      update.archivedAt = new Date();
      update.archivedBy = user.id;
      update.isActive = false;
      auditKind = "members_bulk_archived";
      break;
    case "unarchive":
      update.archivedAt = null;
      update.archivedBy = null;
      update.isActive = true;
      auditKind = "members_bulk_unarchived";
      break;
  }

  const result = await db
    .update(adminUsers)
    .set(update)
    .where(inArray(adminUsers.id, ids))
    .returning({ id: adminUsers.id });

  await audit({
    action: "settings_updated",
    actorId: user.id,
    actorEmail: user.email!,
    details: {
      kind: auditKind,
      action: body.action,
      affected: result.length,
      ids,
      changes: { role: body.role, department: body.department },
    },
  });

  return NextResponse.json({ affected: result.length });
}

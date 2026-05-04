import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isAdminRole } from "@/lib/auth/permissions";
import { eq } from "drizzle-orm";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["admin", "user"]).optional(),
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
  startedAt: z.string().nullable().optional(),
  // Profile fields (admin-editable)
  jobTitle: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
});

/** PATCH /api/members/[id] — update name/role/department (admin-only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json(
      { error: "Only admins can update members." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = updateSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [member] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name;
  if (body.role !== undefined) update.role = body.role === "admin" ? "admin" : "viewer";
  if (body.department !== undefined) update.department = body.department;
  if (body.startedAt !== undefined) {
    update.startedAt = body.startedAt ? new Date(body.startedAt) : null;
  }
  if (body.jobTitle !== undefined) update.jobTitle = body.jobTitle?.trim() || null;
  if (body.location !== undefined) update.location = body.location?.trim() || null;
  if (body.managerId !== undefined) update.managerId = body.managerId || null;
  if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
  if (body.bio !== undefined) update.bio = body.bio?.trim() || null;

  await db.update(adminUsers).set(update).where(eq(adminUsers.id, id));

  await audit({
    action: "settings_updated",
    actorId: user.id,
    actorEmail: user.email!,
    details: {
      kind: "member_updated",
      memberId: id,
      memberEmail: member.email,
      changes: body,
    },
  });

  const [updated] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  return NextResponse.json({ member: updated });
}

/** DELETE /api/members/[id] — permanent delete (admin-only, must be archived first). */
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json(
      { error: "Only admins can delete members." },
      { status: 403 },
    );
  }

  const [member] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (!member.archivedAt) {
    return NextResponse.json(
      { error: "Member must be archived before permanent deletion." },
      { status: 409 },
    );
  }
  if (member.id === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, id));

  await audit({
    action: "settings_updated",
    actorId: user.id,
    actorEmail: user.email!,
    details: {
      kind: "member_deleted",
      memberId: id,
      memberEmail: member.email,
    },
  });

  return NextResponse.json({ ok: true });
}

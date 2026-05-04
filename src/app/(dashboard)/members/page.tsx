import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { desc, isNull, isNotNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { isAdminRole } from "@/lib/auth/permissions";
import { MembersPageClient } from "@/components/members/members-page-client";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const showArchived = params.archived === "1";

  const [members, archivedRows] = await Promise.all([
    db
      .select()
      .from(adminUsers)
      .where(showArchived ? isNotNull(adminUsers.archivedAt) : isNull(adminUsers.archivedAt))
      .orderBy(desc(adminUsers.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers)
      .where(isNotNull(adminUsers.archivedAt)),
  ]);

  const archivedCount = archivedRows[0]?.count ?? 0;

  return (
    <MembersPageClient
      initialMembers={members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        department: m.department || "unassigned",
        isActive: m.isActive,
        archivedAt: m.archivedAt ? m.archivedAt.toISOString() : null,
        startedAt: m.startedAt ? m.startedAt.toISOString() : null,
        invitedAt: m.invitedAt ? m.invitedAt.toISOString() : null,
        lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      }))}
      archivedCount={archivedCount}
      showArchived={showArchived}
      currentUserId={user.id}
      canManage={isAdminRole(user.role)}
    />
  );
}

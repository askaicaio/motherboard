// Affiliate testing-guide checklist — per-user approvals, shared visibility.
// GET    → every approval (grouped by item, with approver identity) + who "you" are
// POST   → add the current user's approval for an item   body: { itemId }
// DELETE → remove the current user's approval            body: { itemId } | { all: true }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  affiliateChecklistApprovals,
  affiliateChecklistComments,
  adminUsers,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Approver {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export async function GET() {
  const user = await requireAuth();

  // The caller's display identity (for optimistic avatar rendering client-side).
  const [me] = await db
    .select({ name: adminUsers.name, avatarUrl: adminUsers.avatarUrl })
    .from(adminUsers)
    .where(eq(adminUsers.id, user.id))
    .limit(1);

  const rows = await db
    .select({
      itemId: affiliateChecklistApprovals.itemId,
      userId: affiliateChecklistApprovals.userId,
      name: adminUsers.name,
      avatarUrl: adminUsers.avatarUrl,
    })
    .from(affiliateChecklistApprovals)
    .innerJoin(
      adminUsers,
      eq(adminUsers.id, affiliateChecklistApprovals.userId),
    );

  const approvals: Record<string, Approver[]> = {};
  for (const r of rows) {
    (approvals[r.itemId] ??= []).push({
      userId: r.userId,
      name: r.name,
      avatarUrl: r.avatarUrl,
    });
  }

  // Comments per item (oldest first), with author identity.
  const commentRows = await db
    .select({
      id: affiliateChecklistComments.id,
      itemId: affiliateChecklistComments.itemId,
      userId: affiliateChecklistComments.userId,
      body: affiliateChecklistComments.body,
      createdAt: affiliateChecklistComments.createdAt,
      name: adminUsers.name,
      avatarUrl: adminUsers.avatarUrl,
    })
    .from(affiliateChecklistComments)
    .innerJoin(
      adminUsers,
      eq(adminUsers.id, affiliateChecklistComments.userId),
    )
    .orderBy(asc(affiliateChecklistComments.createdAt));

  const comments: Record<string, unknown[]> = {};
  for (const c of commentRows) {
    (comments[c.itemId] ??= []).push({
      id: c.id,
      userId: c.userId,
      name: c.name,
      avatarUrl: c.avatarUrl,
      body: c.body,
      createdAt: c.createdAt,
    });
  }

  return NextResponse.json({
    currentUser: {
      userId: user.id,
      name: me?.name ?? user.name ?? "You",
      avatarUrl: me?.avatarUrl ?? null,
    },
    approvals,
    comments,
  });
}

const postSchema = z.object({ itemId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  let itemId: string;
  try {
    ({ itemId } = postSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .insert(affiliateChecklistApprovals)
    .values({ userId: user.id, itemId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.union([
  z.object({ itemId: z.string().min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);

export async function DELETE(request: NextRequest) {
  const user = await requireAuth();
  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if ("all" in body) {
    // Reset — clear only THIS user's approvals.
    await db
      .delete(affiliateChecklistApprovals)
      .where(eq(affiliateChecklistApprovals.userId, user.id));
  } else {
    await db
      .delete(affiliateChecklistApprovals)
      .where(
        and(
          eq(affiliateChecklistApprovals.userId, user.id),
          eq(affiliateChecklistApprovals.itemId, body.itemId),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}

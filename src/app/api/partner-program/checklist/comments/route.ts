// POST /api/partner-program/checklist/comments — add a comment to a checklist
// item. body: { itemId, body }. Returns the created comment with author info.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { affiliateChecklistComments, adminUsers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const schema = z.object({
  itemId: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const user = await requireAuth();

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [created] = await db
    .insert(affiliateChecklistComments)
    .values({ itemId: input.itemId, userId: user.id, body: input.body })
    .returning();

  const [me] = await db
    .select({ name: adminUsers.name, avatarUrl: adminUsers.avatarUrl })
    .from(adminUsers)
    .where(eq(adminUsers.id, user.id))
    .limit(1);

  return NextResponse.json({
    comment: {
      id: created.id,
      userId: user.id,
      name: me?.name ?? user.name ?? "You",
      avatarUrl: me?.avatarUrl ?? null,
      body: created.body,
      createdAt: created.createdAt,
    },
  });
}

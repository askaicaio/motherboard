import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isAdminRole, ALLOWED_EMAIL_DOMAIN_HINT } from "@/lib/auth/permissions";
import { desc, isNull, isNotNull } from "drizzle-orm";

const inviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(200),
  role: z.enum(["admin", "user"]),
  department: z.enum([
    "operations",
    "caio_services",
    "sales",
    "marketing",
    "technology",
    "social_media",
    "podcast_support",
    "unassigned",
  ]),
  startedAt: z.string().optional(), // ISO date
});

/** GET /api/members?archived=1 — list active or archived members. */
export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const archived = request.nextUrl.searchParams.get("archived") === "1";

  const members = await db
    .select()
    .from(adminUsers)
    .where(archived ? isNotNull(adminUsers.archivedAt) : isNull(adminUsers.archivedAt))
    .orderBy(desc(adminUsers.createdAt));

  return NextResponse.json({ members });
}

/** POST /api/members — invite a new member (admin-only). */
export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json(
      { error: "Only admins can invite new members." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = inviteSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  // Enforce org domain — non-org emails would never be able to log in anyway
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || ALLOWED_EMAIL_DOMAIN_HINT;
  if (!body.email.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json(
      { error: `Email must end with @${allowedDomain}` },
      { status: 400 },
    );
  }

  // Map UI 'admin'/'user' to internal 'admin'/'viewer'
  const internalRole = body.role === "admin" ? "admin" : "viewer";

  try {
    const [created] = await db
      .insert(adminUsers)
      .values({
        email: body.email,
        name: body.name,
        role: internalRole,
        department: body.department,
        isActive: true,
        startedAt: body.startedAt ? new Date(body.startedAt) : null,
        invitedAt: new Date(),
        invitedBy: user.id,
      })
      .returning();

    await audit({
      action: "settings_updated", // reuse — could add member_invited later
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        kind: "member_invited",
        memberId: created.id,
        memberEmail: created.email,
        role: internalRole,
        department: body.department,
      },
    });

    return NextResponse.json({ member: created }, { status: 201 });
  } catch (err) {
    // Handle duplicate email (unique constraint)
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("admin_users_email_unique") || message.includes("duplicate key")) {
      return NextResponse.json(
        { error: `A member with email ${body.email} already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

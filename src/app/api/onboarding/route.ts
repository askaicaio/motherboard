import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingRequests } from "@/lib/db/schema";
import { onboardingRequestSchema, onboardingListFilterSchema } from "@/lib/utils/validation";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/options";
import { desc, asc, eq, and, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = onboardingListFilterSchema.parse(searchParams);

    const conditions = [];
    if (filters.status) {
      conditions.push(eq(onboardingRequests.status, filters.status as never));
    }
    if (filters.department) {
      conditions.push(eq(onboardingRequests.department, filters.department));
    }
    if (filters.search) {
      conditions.push(
        sql`(${onboardingRequests.employeeName} ILIKE ${"%" + filters.search + "%"} OR ${onboardingRequests.employeeEmail} ILIKE ${"%" + filters.search + "%"})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.pageSize;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(onboardingRequests)
        .where(where)
        .orderBy(
          filters.sortOrder === "asc"
            ? asc(onboardingRequests.createdAt)
            : desc(onboardingRequests.createdAt)
        )
        .limit(filters.pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(onboardingRequests)
        .where(where),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: totalResult[0].count,
        totalPages: Math.ceil(totalResult[0].count / filters.pageSize),
      },
    });
  } catch (err) {
    console.error("[API] GET /api/onboarding error:", err);
    // Return empty data if DB is not connected (dev mode)
    return NextResponse.json({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  }
}

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = onboardingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const idempotencyKey = body.idempotencyKey;
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "idempotencyKey is required" },
      { status: 400 }
    );
  }

  try {
    // Check idempotency
    const existing = await db.query.onboardingRequests.findFirst({
      where: eq(onboardingRequests.idempotencyKey, idempotencyKey),
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const [created] = await db
      .insert(onboardingRequests)
      .values({
        ...parsed.data,
        requestedTools: parsed.data.requestedTools,
        slackChannels: parsed.data.slackChannels || [],
        googleGroups: parsed.data.googleGroups || [],
        idempotencyKey,
        status: "pending_approval",
        createdBy: user.id,
      })
      .returning();

    await audit({
      action: "request_created",
      requestId: created.id,
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      details: {
        employeeName: created.employeeName,
        employeeEmail: created.employeeEmail,
        department: created.department,
        division: created.division,
        tools: created.requestedTools,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[API] POST /api/onboarding error:", err);
    return NextResponse.json(
      { error: "Database error. Ensure DATABASE_URL is configured." },
      { status: 500 }
    );
  }
}

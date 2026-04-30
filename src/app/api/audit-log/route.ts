import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import { auditLogFilterSchema } from "@/lib/utils/validation";
import { desc, eq, and, gte, lte, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const filters = auditLogFilterSchema.parse(searchParams);

  const conditions = [];
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action as never));
  }
  if (filters.requestId) {
    conditions.push(eq(auditLogs.requestId, filters.requestId));
  }
  if (filters.actorId) {
    conditions.push(eq(auditLogs.actorId, filters.actorId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(auditLogs)
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
}

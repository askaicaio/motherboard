import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { desc, isNull, isNotNull } from "drizzle-orm";

const createReportSchema = z.object({
  companyName: z.string().min(1).max(200),
  industry: z.string().max(200).optional(),
  knownDetails: z.string().max(5000).optional(),
  titleFormat: z.enum(["strategic_growth", "ebitda_expansion"]),
});

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?archived=1 → only archived reports
  // default → only active (non-archived) reports
  const archived = request.nextUrl.searchParams.get("archived") === "1";

  const reports = await db
    .select()
    .from(companyReports)
    .where(
      archived
        ? isNotNull(companyReports.archivedAt)
        : isNull(companyReports.archivedAt),
    )
    .orderBy(desc(companyReports.createdAt))
    .limit(500);

  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createReportSchema.parse(body);

    const [created] = await db
      .insert(companyReports)
      .values({
        companyName: data.companyName,
        industry: data.industry || null,
        knownDetails: data.knownDetails || null,
        titleFormat: data.titleFormat,
        createdBy: user.id,
      })
      .returning();

    await audit({
      action: "report_created",
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        reportId: created.id,
        companyName: created.companyName,
        titleFormat: created.titleFormat,
      },
    });

    return NextResponse.json({ report: created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

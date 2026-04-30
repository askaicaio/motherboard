import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { provisioningRules } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { provisioningRuleSchema } from "@/lib/utils/validation";
import { audit } from "@/lib/audit/logger";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await db
    .select()
    .from(provisioningRules)
    .orderBy(asc(provisioningRules.priority));

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = provisioningRuleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(provisioningRules)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      matchDepartment: parsed.data.matchDepartment ?? null,
      matchDivision: parsed.data.matchDivision ?? null,
      matchJobTitle: parsed.data.matchJobTitle ?? null,
      toolKey: parsed.data.toolKey,
      toolConfig: parsed.data.toolConfig,
      priority: parsed.data.priority,
      isActive: parsed.data.isActive,
    })
    .returning();

  const user = session.user as SessionUser;
  await audit({
    action: "rule_created",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { ruleId: created.id, ruleName: created.name, toolKey: created.toolKey },
  });

  return NextResponse.json(created, { status: 201 });
}

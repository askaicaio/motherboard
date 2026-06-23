// GET  /api/members/access — current per-department tab visibility config
// PUT  /api/members/access — replace the config (admin only)
//
// Config shape: { [department]: string[] } where the array lists the tab
// hrefs HIDDEN for that department (deny-list). Applies to members with the
// viewer role; admins/super_admins always see everything.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, getOptionalAuth } from "@/lib/auth/guard";
import {
  getDepartmentTabVisibility,
  setDepartmentTabVisibility,
} from "@/lib/layout/visibility";
import { MANAGEABLE_TABS } from "@/lib/layout/nav";
import { DEPARTMENTS_LIST } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getDepartmentTabVisibility();
  return NextResponse.json({
    config,
    departments: DEPARTMENTS_LIST,
    tabs: MANAGEABLE_TABS,
  });
}

const putSchema = z.object({
  // department → array of hidden hrefs
  config: z.record(z.string(), z.array(z.string())),
});

export async function PUT(request: NextRequest) {
  const user = await requireRole("admin");

  let body;
  try {
    body = putSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  // Keep only known departments + known tab hrefs — never persist garbage.
  const validHrefs = new Set(MANAGEABLE_TABS.map((t) => t.href));
  const validDepts = new Set(DEPARTMENTS_LIST.map((d) => d.value));
  const clean: Record<string, string[]> = {};
  for (const [dept, hrefs] of Object.entries(body.config)) {
    if (!validDepts.has(dept as never)) continue;
    const filtered = hrefs.filter((h) => validHrefs.has(h));
    if (filtered.length > 0) clean[dept] = filtered;
  }

  await setDepartmentTabVisibility(clean, user.id);
  return NextResponse.json({ ok: true, config: clean });
}

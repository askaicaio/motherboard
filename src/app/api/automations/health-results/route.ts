// POST /api/automations/health-results — persist a batch of per-platform API
// health-check results (from the Main Page "API Health Check" fan-out) so the
// cards reflect the last actual check across a page reload. Auth-gated. Only
// booleans are stored; the real verification already ran server-side in
// /api/automations/check-key.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { recordHealthResults } from "@/lib/automations/health";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  results: z.array(z.object({ platform: z.string(), ok: z.boolean() })),
});

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    throw err;
  }

  const oks: Record<string, boolean> = {};
  for (const r of body.results) oks[r.platform] = r.ok;
  await recordHealthResults(oks);

  return NextResponse.json({ ok: true });
}

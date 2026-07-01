// GET  /api/automations/health-autocheck — read the Auto-API health check state
//      ({ enabled, nextCheckAt, results }).
// POST /api/automations/health-autocheck — toggle it on/off ({ enabled }).
//
// Unlike the per-website auto-refresh toggle, this is NOT gated on any API
// integration: the whole point is to check ALL platforms (a platform with no
// key simply reads red). One global toggle, not per-platform.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { getHealthState, setAutoHealthCheck } from "@/lib/automations/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = await getHealthState();
  return NextResponse.json({ state });
}

const postSchema = z.object({ enabled: z.boolean() });

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = postSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const state = await setAutoHealthCheck(body.enabled, user.id);
  return NextResponse.json({ ok: true, state });
}

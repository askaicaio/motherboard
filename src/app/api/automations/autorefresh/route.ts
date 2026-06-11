// GET  /api/automations/autorefresh?platform=<slug> — read a platform's
//      auto-refresh state ({ enabled, nextRefreshAt }).
// POST /api/automations/autorefresh — toggle it on/off ({ platform, enabled }).
//
// Turning ON is blocked unless the platform has a real sync AND an API
// credential configured (the per-website toggle surfaces this as a red error).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isSyncablePlatform } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshFor, setAutoRefresh } from "@/lib/automations/autorefresh";

export const dynamic = "force-dynamic";

const NO_INTEGRATION_ERROR =
  "Can't auto-refresh. This website has no API integration yet.";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform) {
    return NextResponse.json({ error: "platform required" }, { status: 400 });
  }
  const state = await getAutoRefreshFor(platform);
  return NextResponse.json({ state });
}

const postSchema = z.object({ platform: z.string(), enabled: z.boolean() });

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

  const { platform, enabled } = body;

  // Gate: only allow turning ON when the platform can actually sync.
  if (enabled && (!isSyncablePlatform(platform) || !platformHasApiKey(platform))) {
    return NextResponse.json({ error: NO_INTEGRATION_ERROR }, { status: 400 });
  }

  const state = await setAutoRefresh(platform, enabled, user.id);
  return NextResponse.json({ ok: true, state });
}

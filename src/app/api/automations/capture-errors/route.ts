// POST /api/automations/capture-errors — manual "check for new errors now".
//
// Doesn't run the sweep itself (that would need the tab open for minutes). It
// just makes the error sweep DUE, so the next 5-min checker cron runs the full
// sweep server-side, unattended — the user can close the app. Instant response.
// Light guard (see requestErrorSweep) ignores mashing / just-ran requests.
//
// Body: { platform }. Only error-capture platforms (Make) are accepted; others
// 400 (the button placeholder-errors client-side for those anyway).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isErrorCapturePlatform } from "@/lib/automations/sites";
import { requestErrorSweep } from "@/lib/automations/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ platform: z.string() });

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (!isErrorCapturePlatform(body.platform)) {
    return NextResponse.json(
      { error: `Error tracking isn't set up for ${body.platform} yet.` },
      { status: 400 },
    );
  }

  const result = await requestErrorSweep();
  return NextResponse.json({ ok: true, ...result });
}

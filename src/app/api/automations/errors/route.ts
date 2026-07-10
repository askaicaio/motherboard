// GET /api/automations/errors?platform=<slug>
//
// This platform's captured error events (newest first), as JSON. Lets the Error
// History page re-fetch its rows client-side (e.g. when the auto-refresh
// countdown elapses) so newly-captured errors appear WITHOUT a full page reload.
// Same role the GET /api/automations list plays for the Per Website table.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { getErrorHistoryRows } from "@/lib/automations/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  const errors = await getErrorHistoryRows(platform);
  return NextResponse.json({ errors });
}
